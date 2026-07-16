const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SPACE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type LoopDeepLink =
  | { kind: "none" }
  | { kind: "invalid" }
  | {
      kind: "valid";
      issueId: string;
      workspaceId: string;
      spaceId: string;
    };

function exactlyOne(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name);
  return values.length === 1 ? values[0].trim() : null;
}

/** Parse the server-authored `/loop?issue=&workspace=&sp=` card target. */
export function parseLoopDeepLink(search: string): LoopDeepLink {
  if (typeof search !== "string") return { kind: "invalid" };
  const params = new URLSearchParams(search);
  const hasDeepLinkField = ["issue", "workspace", "sp"].some((name) =>
    params.has(name)
  );
  if (!hasDeepLinkField) return { kind: "none" };

  const issueId = exactlyOne(params, "issue");
  const workspaceId = exactlyOne(params, "workspace");
  const spaceId = exactlyOne(params, "sp");
  if (
    !issueId ||
    !workspaceId ||
    !spaceId ||
    !UUID.test(issueId) ||
    !UUID.test(workspaceId) ||
    !SPACE_ID.test(spaceId)
  ) {
    return { kind: "invalid" };
  }

  return { kind: "valid", issueId, workspaceId, spaceId };
}
