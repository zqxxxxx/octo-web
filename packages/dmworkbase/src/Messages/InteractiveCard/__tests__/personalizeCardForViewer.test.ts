import { describe, expect, it } from "vitest";
import { personalizeCardForViewer } from "../personalizeCardForViewer";

function loopCard() {
  return {
    type: "AdaptiveCard",
    version: "1.5",
    metadata: {
      octo: { loop: { reviewerUid: "reviewer-1", confirmationId: "c-1" } },
    },
    body: [{ type: "TextBlock", text: "Loop" }],
    actions: [
      { type: "Action.OpenUrl", title: "查看", url: "https://octo.test/loop" },
      {
        type: "Action.Submit",
        id: "loop_confirm",
        title: "快捷确认",
        data: { operation: "loop.confirm", reviewer_uid: "reviewer-1" },
      },
    ],
  };
}

describe("personalizeCardForViewer", () => {
  it("指定审批人保留快捷确认按钮", () => {
    const card = loopCard();
    expect(personalizeCardForViewer(card, "reviewer-1")).toBe(card);
    expect(card.actions).toHaveLength(2);
  });

  it("其他成员和缺失身份只看到普通动作，且不修改原卡", () => {
    for (const viewerUID of ["other-user", undefined]) {
      const card = loopCard();
      const personalized = personalizeCardForViewer(card, viewerUID);
      expect(personalized).not.toBe(card);
      expect(personalized.actions).toEqual([card.actions[0]]);
      expect(card.actions).toHaveLength(2);
    }
  });

  it("没有 Loop audience 元数据的 Submit 保持现有行为", () => {
    const card = {
      type: "AdaptiveCard",
      actions: [
        { type: "Action.Submit", id: "other", data: { operation: "other" } },
      ],
    };
    expect(personalizeCardForViewer(card, "viewer")).toBe(card);
  });
});
