import { AdaptiveCard, type Action } from "adaptivecards";
import { cardMarkdownToSafeHtml } from "../renderer/cardMarkdownHtml";
import { browserCssVarResolver, buildOctoHostConfig } from "./octoHostConfig";
import { createOctoSerializationContext } from "./octoSerialization";
import { sanitizeCardTree } from "./sanitizeCardTree";
import { enhanceAgentProgressLayout } from "./agentProgressLayout";
import { attachTableCopyButtons } from "./tableCopy";

/**
 * 用官方 AdaptiveCards SDK 渲染一张**已通过 octo 预校验**的卡片进目标元素。
 *
 * - `onProcessMarkdown` 是 SDK 全局静态钩子，安装一次即可（Spike F1：不设则含 markdown 的
 *   TextBlock 正文渲染为空）；接自研 `cardMarkdownToSafeHtml`，安全面复用现有 sanitize/allowlist。
 * - HostConfig 用 `browserCssVarResolver(target)` 就地解析 `--wk-*`，自动随当前主题。
 * - 反序列化用 octo 受限 context（动作层只留 octo 白名单动作）。
 * - 调用方须保证 target 已在文档中（否则 getComputedStyle 解析不到主题色）。
 */

let markdownHookInstalled = false;

interface CardElementVisibility {
  type: string;
  initiallyVisible: boolean;
}

function collectCardElementVisibility(
  value: unknown,
  output: Map<string, CardElementVisibility>
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCardElementVisibility(item, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  if (typeof node.id === "string" && node.id) {
    output.set(node.id, {
      type: typeof node.type === "string" ? node.type : "",
      initiallyVisible: node.isVisible !== false,
    });
  }
  Object.values(node).forEach((item) =>
    collectCardElementVisibility(item, output)
  );
}

function elementIsVisible(element: HTMLElement | null): boolean {
  if (!element) return false;
  return (
    !element.hidden &&
    element.getAttribute("aria-hidden") !== "true" &&
    element.style.display !== "none"
  );
}

/** Keep the SDK's visual ToggleVisibility state available to assistive tech. */
function enhanceToggleVisibilityAccessibility(
  card: Record<string, unknown>,
  target: HTMLElement
): void {
  const visibility = new Map<string, CardElementVisibility>();
  collectCardElementVisibility(card, visibility);

  const bindings: Array<{ control: HTMLElement; stateId: string }> = [];

  target.querySelectorAll<HTMLElement>("[aria-controls]").forEach((control) => {
    const controlledIds = (control.getAttribute("aria-controls") ?? "")
      .split(/\s+/)
      .filter(Boolean);
    if (controlledIds.length === 0) return;

    // Prefer a content element that starts collapsed. Summary cards also
    // toggle their expand/collapse ActionSets; using those controls as the
    // state anchor would invert aria-expanded on the visible Collapse button.
    const stateId =
      controlledIds.find((id) => {
        const entry = visibility.get(id);
        return entry && entry.type !== "ActionSet" && !entry.initiallyVisible;
      }) ??
      controlledIds.find((id) => visibility.get(id)?.type !== "ActionSet") ??
      controlledIds[0];

    bindings.push({ control, stateId });
  });

  const syncAll = () => {
    bindings.forEach(({ control, stateId }) => {
      const stateElement =
        Array.from(target.querySelectorAll<HTMLElement>("[id]")).find(
          (element) => element.id === stateId
        ) ?? null;
      control.setAttribute(
        "aria-expanded",
        String(elementIsVisible(stateElement))
      );
    });
  };
  syncAll();
  bindings.forEach(({ control }) => {
    control.addEventListener("click", () => queueMicrotask(syncAll));
  });
}

function ensureMarkdownHook(): void {
  if (markdownHookInstalled) return;
  AdaptiveCard.onProcessMarkdown = (text, result) => {
    result.outputHtml = cardMarkdownToSafeHtml(text);
    result.didProcess = true;
  };
  markdownHookInstalled = true;
}

export interface RenderOctoCardOptions {
  card: Record<string, unknown>;
  target: HTMLElement;
  /**
   * 动作执行回调，收到动作与其所属卡片实例（用于 Submit 收集 getAllInputs）。
   * OpenUrl 导航 / Submit 提交由 Cell 决定。
   */
  onAction: (action: Action, card: AdaptiveCard) => void;
  tableCopyLabel?: string;
  onTableCopy?: (text: string) => void;
}

export function enhanceRenderedOctoCard(options: RenderOctoCardOptions): void {
  const { card, target, tableCopyLabel, onTableCopy } = options;
  enhanceAgentProgressLayout(card, target);
  enhanceToggleVisibilityAccessibility(card, target);
  if (tableCopyLabel && onTableCopy) {
    attachTableCopyButtons({
      card,
      target,
      label: tableCopyLabel,
      onCopy: onTableCopy,
    });
  }
}

export function renderOctoCard(options: RenderOctoCardOptions): void {
  const { card, target, onAction, tableCopyLabel, onTableCopy } = options;
  ensureMarkdownHook();
  const ac = new AdaptiveCard();
  ac.hostConfig = buildOctoHostConfig(browserCssVarResolver(target));
  ac.onExecuteAction = (action) => onAction(action, ac);
  // 图片类 URL 消毒（https-only），在 parse 前——SDK 自身不做 scheme 检查。
  ac.parse(sanitizeCardTree(card), createOctoSerializationContext());
  const rendered = ac.render();
  target.textContent = "";
  if (rendered) target.appendChild(rendered);
  if (rendered)
    enhanceRenderedOctoCard({
      card,
      target,
      onAction,
      tableCopyLabel,
      onTableCopy,
    });
}

export default renderOctoCard;
