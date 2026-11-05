/**
 * GraphQL operations used by Legible. Every field here is taken from the
 * Buffer API reference (developers.buffer.com/reference.html).
 */
import { BufferMutationError } from "./errors";

export const ACCOUNT_QUERY = /* GraphQL */ `
  query Account {
    account {
      id
      email
      name
      timezone
      organizations {
        id
        name
      }
    }
  }
`;

export interface AccountData {
  account: {
    id: string;
    email: string;
    name: string | null;
    timezone: string | null;
    organizations: { id: string; name: string }[];
  };
}

export const CHANNELS_QUERY = /* GraphQL */ `
  query Channels($organizationId: OrganizationId!) {
    channels(input: { organizationId: $organizationId }) {
      id
      name
      displayName
      service
      avatar
      timezone
      isDisconnected
      isQueuePaused
    }
  }
`;

export interface ChannelData {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  avatar: string;
  timezone: string;
  isDisconnected: boolean;
  isQueuePaused: boolean;
}

const POST_FIELDS = /* GraphQL */ `
  fragment LegiblePost on Post {
    id
    text
    status
    dueAt
    channelId
    channelService
    metadata {
      __typename
      ... on ThreadedPostMetadata {
        threadCount
      }
    }
    assets {
      __typename
      type
      source
      thumbnail
      ... on ImageAsset {
        image {
          altText
          userTags {
            handle
            x
            y
          }
        }
      }
      ... on VideoAsset {
        video {
          thumbnailOffset
          title
        }
      }
      ... on DocumentAsset {
        document {
          title
        }
      }
    }
  }
`;

/**
 * One request, two aliased connections: upcoming scheduled/awaiting-approval
 * posts in the window, plus the most recent drafts (which may have no dueAt).
 * Counting as a single API call matters: the quota is shared by every user.
 */
export const SCAN_QUERY = /* GraphQL */ `
  ${POST_FIELDS}
  query Scan($organizationId: OrganizationId!, $start: DateTime!, $end: DateTime!) {
    upcoming: posts(
      first: 100
      input: {
        organizationId: $organizationId
        filter: { status: [scheduled, needs_approval], dueAt: { start: $start, end: $end } }
        sort: [{ field: dueAt, direction: asc }]
      }
    ) {
      edges {
        node {
          ...LegiblePost
        }
      }
      pageInfo {
        hasNextPage
      }
    }
    drafts: posts(
      first: 50
      input: {
        organizationId: $organizationId
        filter: { status: [draft] }
        sort: [{ field: createdAt, direction: desc }]
      }
    ) {
      edges {
        node {
          ...LegiblePost
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

export interface ApiAsset {
  __typename: "ImageAsset" | "VideoAsset" | "DocumentAsset";
  type: "image" | "video" | "document";
  source: string;
  thumbnail: string;
  image?: { altText: string; userTags: { handle: string; x: number; y: number }[] | null };
  video?: { thumbnailOffset: number | null; title: string | null };
  document?: { title: string | null };
}

export interface ApiPost {
  id: string;
  text: string;
  status: string;
  dueAt: string | null;
  channelId: string;
  channelService: string;
  metadata: { __typename: string; threadCount?: number } | null;
  assets: ApiAsset[];
}

/**
 * Threads (X, Bluesky, Threads, Mastodon) keep their text in metadata.thread,
 * and the top-level text must match the first item. Legible does not edit
 * threads; it offers a Buffer Note instead.
 */
export function isThread(post: Pick<ApiPost, "metadata">): boolean {
  return (post.metadata?.threadCount ?? 0) > 1;
}

interface Connection {
  edges: { node: ApiPost }[] | null;
  pageInfo: { hasNextPage: boolean };
}

export interface ScanData {
  upcoming: Connection;
  drafts: Connection;
}

export const POST_QUERY = /* GraphQL */ `
  ${POST_FIELDS}
  query Post($id: PostId!) {
    post(input: { id: $id }) {
      ...LegiblePost
    }
  }
`;

export interface PostData {
  post: ApiPost;
}

export const EDIT_POST_MUTATION = /* GraphQL */ `
  ${POST_FIELDS}
  mutation EditPost($input: EditPostInput!) {
    editPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post {
          ...LegiblePost
        }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

export interface EditPostData {
  editPost: { __typename: string; post?: ApiPost; message?: string };
}

export const CREATE_NOTE_MUTATION = /* GraphQL */ `
  mutation CreateNote($input: CreateCollaborationNoteInput!) {
    createCollaborationNote(input: $input) {
      __typename
      ... on CreateCollaborationNoteSuccess {
        edge {
          node {
            id
          }
        }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

export interface CreateNoteData {
  createCollaborationNote: { __typename: string; edge?: { node: { id: string } }; message?: string };
}

/** Throw a BufferMutationError if a mutation union resolved to an error type. */
export function assertMutation<T extends { __typename: string; message?: string }>(
  result: T,
  successTypename: string,
): T {
  if (result.__typename !== successTypename) {
    throw new BufferMutationError(result.message ?? `Buffer returned ${result.__typename}`, result.__typename);
  }
  return result;
}

/** Editable statuses: Buffer can only change posts that haven't gone out. */
export const EDITABLE_STATUSES = new Set(["draft", "scheduled", "needs_approval"]);

export interface AssetInput {
  image?: { url: string; metadata: { altText: string; userTags?: { handle: string; x: number; y: number }[] } };
  video?: { url: string; metadata?: { thumbnailOffset?: number; title?: string } };
  document?: { url: string; thumbnailUrl: string; title: string };
}

/**
 * Rebuild the full `assets` input for editPost from the post's current assets,
 * replacing alt text where asked. editPost replaces the whole list, so every
 * asset (and its user tags, thumbnail offset, title) must be carried over.
 */
export function rebuildAssets(assets: ApiAsset[], altTexts: Record<number, string>): AssetInput[] {
  return assets.map((a, i) => {
    if (a.type === "image") {
      const userTags = a.image?.userTags ?? undefined;
      return {
        image: {
          url: a.source,
          metadata: {
            altText: altTexts[i] ?? a.image?.altText ?? "",
            ...(userTags && userTags.length ? { userTags } : {}),
          },
        },
      };
    }
    if (a.type === "video") {
      const metadata: { thumbnailOffset?: number; title?: string } = {};
      if (a.video?.thumbnailOffset != null) metadata.thumbnailOffset = a.video.thumbnailOffset;
      if (a.video?.title) metadata.title = a.video.title;
      return { video: { url: a.source, ...(Object.keys(metadata).length ? { metadata } : {}) } };
    }
    return { document: { url: a.source, thumbnailUrl: a.thumbnail, title: a.document?.title ?? "Document" } };
  });
}
