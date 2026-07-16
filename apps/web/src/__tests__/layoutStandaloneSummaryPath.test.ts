import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutPath = path.resolve(__dirname, "../Layout/index.tsx");
const layout = fs.readFileSync(layoutPath, "utf8");

describe("Layout standalone Summary card route", () => {
  it("intercepts /s/:taskId before the standalone document and normal shell branches", () => {
    const summaryIndex = layout.indexOf(
      "if (isStandaloneSummaryPath(window.location.pathname))"
    );
    const docsIndex = layout.indexOf(
      "if (isStandaloneDocPath(window.location.pathname))"
    );
    const shellIndex = layout.indexOf("return <Provider create={() =>");

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeLessThan(docsIndex);
    expect(summaryIndex).toBeLessThan(shellIndex);
    expect(layout).toContain("recoverOctoSessionFromStorage(true)");
    expect(layout).toContain(
      "parseStandaloneSummaryTaskId(window.location.pathname)"
    );
    expect(layout).toContain(
      "<StandaloneSummaryPage taskId={taskId} spaceId={spaceId} />"
    );
  });

  it("preserves the card Space binding across an anonymous login redirect", () => {
    expect(layout).toContain(
      "parseStandaloneSummarySpaceId(window.location.search)"
    );
    expect(layout).toContain("persistAuthReturnTarget()");
    expect(layout).toContain("consumeAuthReturnTarget()");
  });

  it("fails a malformed Summary target before starting authentication", () => {
    const summaryIndex = layout.indexOf(
      "if (isStandaloneSummaryPath(window.location.pathname))"
    );
    const invalidIndex = layout.indexOf(
      "if (taskId == null || spaceId == null)",
      summaryIndex
    );
    const authIndex = layout.indexOf(
      "if (!WKApp.loginInfo.token)",
      summaryIndex
    );

    expect(invalidIndex).toBeGreaterThan(summaryIndex);
    expect(invalidIndex).toBeLessThan(authIndex);
  });

  it("keeps the complete Loop target even when browser session storage is unavailable", () => {
    expect(layout).toContain('redirectQuery.set("issue", loopReturn.issueId)');
    expect(layout).toContain(
      'redirectQuery.set("workspace", loopReturn.workspaceId)'
    );
    expect(layout).toContain('redirectQuery.set("sp", loopReturn.spaceId)');
  });
});
