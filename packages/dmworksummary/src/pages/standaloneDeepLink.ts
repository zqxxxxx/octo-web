const STANDALONE_SUMMARY_NAMESPACE = /^\/s(?:\/|$)/;
const STANDALONE_SUMMARY_PATH = /^\/s\/([1-9]\d*)\/?$/;
const SPACE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Whether a path belongs to the standalone Summary namespace. */
export function isStandaloneSummaryPath(pathname: string): boolean {
  return (
    typeof pathname === "string" && STANDALONE_SUMMARY_NAMESPACE.test(pathname)
  );
}

/** Parse `/s/:taskId`; malformed, zero, negative, and unsafe integers fail closed. */
export function parseStandaloneSummaryTaskId(pathname: string): number | null {
  if (typeof pathname !== "string") return null;
  const match = STANDALONE_SUMMARY_PATH.exec(pathname);
  if (!match) return null;
  const taskId = Number(match[1]);
  return Number.isSafeInteger(taskId) && taskId > 0 ? taskId : null;
}

/** Parse the card-authored Space binding without accepting control/path characters. */
export function parseStandaloneSummarySpaceId(search: string): string | null {
  if (typeof search !== "string") return null;
  const values = new URLSearchParams(search).getAll("sp");
  if (values.length !== 1) return null;
  const value = values[0].trim();
  return SPACE_ID.test(value) ? value : null;
}
