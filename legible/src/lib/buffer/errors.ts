export class BufferApiError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BufferApiError";
  }
}

/** A typed MutationError returned inside `data` (HTTP 200). User-fixable. */
export class BufferMutationError extends Error {
  constructor(
    message: string,
    readonly typename?: string,
  ) {
    super(message);
    this.name = "BufferMutationError";
  }
}

export class RateLimitedError extends Error {
  constructor(
    readonly window: string,
    readonly retryAfterSeconds: number,
  ) {
    super(`Buffer rate limit reached on the ${window} window; retry in ${retryAfterSeconds}s`);
    this.name = "RateLimitedError";
  }
}

/** The grant is gone (revoked, replayed refresh token, 401). The user must reconnect. */
export class ReauthRequiredError extends Error {
  constructor(message = "Buffer connection expired. Please reconnect.") {
    super(message);
    this.name = "ReauthRequiredError";
  }
}
