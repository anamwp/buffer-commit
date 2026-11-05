import { BufferApiError, RateLimitedError, ReauthRequiredError } from "./errors";
import { parseRateLimit, type RateLimitWindow } from "./ratelimit";

export interface GraphQLResult<T> {
  data: T;
  rateLimits: RateLimitWindow[];
}

export interface GraphQLOptions {
  apiUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  /** Wait out a 429 inline only if Retry-After is at most this many seconds. */
  maxInlineWaitSeconds?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST a GraphQL document to Buffer. GraphQL returns 200 even for errors, so
 * the `errors` array is checked explicitly; typed MutationErrors live in `data`
 * and are handled by the caller.
 */
export async function bufferGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  opts: GraphQLOptions,
): Promise<GraphQLResult<T>> {
  const doFetch = opts.fetchImpl ?? fetch;
  const maxWait = opts.maxInlineWaitSeconds ?? 5;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await doFetch(opts.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "Legible/0.1 (+https://github.com/anamwp/buffer-commit)",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
    const rateLimits = parseRateLimit(res.headers.get("ratelimit"), res.headers.get("ratelimit-policy"));

    if (res.status === 401) throw new ReauthRequiredError();
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "0");
      let window = "unknown";
      try {
        const body = (await res.json()) as { errors?: { extensions?: { window?: string } }[] };
        window = body.errors?.[0]?.extensions?.window ?? window;
      } catch {
        /* ignore */
      }
      if (attempt === 1 && retryAfter > 0 && retryAfter <= maxWait) {
        await sleep((retryAfter + Math.random()) * 1000);
        continue;
      }
      throw new RateLimitedError(window, retryAfter);
    }
    if (!res.ok) {
      throw new BufferApiError(`Buffer API responded ${res.status}`, await res.text().catch(() => undefined));
    }
    const body = (await res.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
    if (body.errors?.length) {
      const first = body.errors[0];
      if (first.extensions?.code === "UNAUTHENTICATED" || first.extensions?.code === "UNAUTHORIZED") {
        // UNAUTHORIZED can also mean "not allowed on this resource"; only treat a
        // missing `data` as a dead grant.
        if (!body.data) throw new ReauthRequiredError();
      }
      if (first.extensions?.code === "RATE_LIMIT_EXCEEDED") throw new RateLimitedError("unknown", 60);
      throw new BufferApiError(body.errors.map((e) => e.message).join("; "), body.errors);
    }
    if (!body.data) throw new BufferApiError("Buffer API returned no data");
    return { data: body.data, rateLimits };
  }
  throw new BufferApiError("unreachable");
}
