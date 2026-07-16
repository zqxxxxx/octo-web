// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import {
  isStandaloneSummaryPath,
  parseStandaloneSummarySpaceId,
  parseStandaloneSummaryTaskId,
} from "../standaloneDeepLink";

vi.mock("@octo/base", () => ({ t: (key: string) => key }));
vi.mock("@douyinfe/semi-ui", () => ({
  Button: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", null, children),
  Empty: ({
    title,
    description,
    children,
  }: {
    title: React.ReactNode;
    description: React.ReactNode;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "section",
      null,
      title,
      React.createElement("p", null, description),
      children
    ),
}));
vi.mock("../SummaryDetailPage", () => ({
  default: ({ taskId }: { taskId: number }) =>
    React.createElement("div", { "data-testid": "summary-detail" }, taskId),
}));

import StandaloneSummaryPage from "../StandaloneSummaryPage";

describe("standalone Summary deep link", () => {
  it("claims the whole top-level /s namespace", () => {
    expect(isStandaloneSummaryPath("/s/42")).toBe(true);
    expect(isStandaloneSummaryPath("/s/")).toBe(true);
    expect(isStandaloneSummaryPath("/summary")).toBe(false);
    expect(isStandaloneSummaryPath("/docs/s/42")).toBe(false);
  });

  it("parses only positive safe integer task IDs", () => {
    expect(parseStandaloneSummaryTaskId("/s/42")).toBe(42);
    expect(parseStandaloneSummaryTaskId("/s/42/")).toBe(42);
    for (const invalid of [
      "/s/",
      "/s/0",
      "/s/-1",
      "/s/TN_abc",
      "/s/1/extra",
      "/s/9007199254740992",
    ]) {
      expect(parseStandaloneSummaryTaskId(invalid)).toBeNull();
    }
  });

  it("accepts only bounded Space IDs from the card query", () => {
    expect(parseStandaloneSummarySpaceId("?sp=space-9")).toBe("space-9");
    expect(parseStandaloneSummarySpaceId("?sp=%20space_9%20&sid=x")).toBe(
      "space_9"
    );
    expect(parseStandaloneSummarySpaceId("?sp=../../other")).toBeNull();
    expect(parseStandaloneSummarySpaceId("?sp=space-9&sp=space-10")).toBeNull();
    expect(parseStandaloneSummarySpaceId(`?sp=${"x".repeat(65)}`)).toBeNull();
    expect(parseStandaloneSummarySpaceId("")).toBeNull();
  });

  it("renders a terminal state and never requests details when task or Space is invalid", async () => {
    const { rerender } = render(
      React.createElement(StandaloneSummaryPage, { taskId: 42, spaceId: null })
    );
    expect(
      await screen.findByText("summary.deepLink.invalidTitle")
    ).toBeTruthy();
    expect(screen.queryByTestId("summary-detail")).toBeNull();

    rerender(
      React.createElement(StandaloneSummaryPage, {
        taskId: null,
        spaceId: "space-9",
      })
    );
    expect(screen.queryByTestId("summary-detail")).toBeNull();
  });

  it("renders the requested Summary only when both identifiers are valid", async () => {
    render(
      React.createElement(StandaloneSummaryPage, {
        taskId: 42,
        spaceId: "space-9",
      })
    );
    expect((await screen.findByTestId("summary-detail")).textContent).toBe(
      "42"
    );
  });
});
