import { describe, expect, it } from "vitest";
import { parseLoopDeepLink } from "../loopDeepLink";

const ISSUE_ID = "10000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "20000000-0000-4000-8000-000000000002";

describe("Loop card deep link", () => {
  it("keeps the ordinary /loop entry distinct from a card target", () => {
    expect(parseLoopDeepLink("")).toEqual({ kind: "none" });
    expect(parseLoopDeepLink("?sid=session-1")).toEqual({ kind: "none" });
  });

  it("parses one exact issue, workspace, and Octo Space binding", () => {
    expect(
      parseLoopDeepLink(
        `?issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}&sp=space_9&sid=session-1`
      )
    ).toEqual({
      kind: "valid",
      issueId: ISSUE_ID,
      workspaceId: WORKSPACE_ID,
      spaceId: "space_9",
    });
  });

  it.each([
    `?issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}`,
    `?issue=not-a-uuid&workspace=${WORKSPACE_ID}&sp=space_9`,
    `?issue=${ISSUE_ID}&workspace=../../other&sp=space_9`,
    `?issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}&sp=../../other`,
    `?issue=${ISSUE_ID}&issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}&sp=space_9`,
  ])("fails closed for malformed or ambiguous target %s", (search) => {
    expect(parseLoopDeepLink(search)).toEqual({ kind: "invalid" });
  });
});
