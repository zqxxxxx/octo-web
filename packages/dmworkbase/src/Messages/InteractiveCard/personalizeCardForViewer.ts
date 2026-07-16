/**
 * Server-authored per-viewer presentation policy for Loop quick confirmation.
 *
 * Adaptive Cards has no standard audience field. Octo therefore authors the
 * explicit reviewer UID in `metadata.octo.loop.reviewerUid`; the Web Host
 * removes only the matching `loop.confirm` Submit action for every other
 * viewer. This is presentation privacy, not authorization: the action endpoint
 * independently enforces the reviewer UID and active card revision.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function loopReviewerUID(card: Record<string, unknown>): string {
  const metadata = asRecord(card.metadata);
  const octo = asRecord(metadata?.octo);
  const loop = asRecord(octo?.loop);
  return typeof loop?.reviewerUid === "string" ? loop.reviewerUid.trim() : "";
}

function isLoopConfirmAction(value: unknown): boolean {
  const action = asRecord(value);
  const data = asRecord(action?.data);
  return action?.type === "Action.Submit" && data?.operation === "loop.confirm";
}

export function personalizeCardForViewer(
  card: Record<string, unknown>,
  viewerUID: string | undefined
): Record<string, unknown> {
  const reviewerUID = loopReviewerUID(card);
  if (reviewerUID === "" || reviewerUID === viewerUID?.trim()) {
    return card;
  }
  if (!Array.isArray(card.actions)) return card;

  const actions = card.actions.filter((action) => !isLoopConfirmAction(action));
  if (actions.length === card.actions.length) return card;
  return { ...card, actions };
}

export default personalizeCardForViewer;
