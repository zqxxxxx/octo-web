import { parseLoopDeepLink } from "@octo/loop/src/pages/loopDeepLink";
import {
  isStandaloneSummaryPath,
  parseStandaloneSummarySpaceId,
  parseStandaloneSummaryTaskId,
} from "@dmwork/summary/src/pages/standaloneDeepLink";

export const AUTH_RETURN_KEY = "octo.web.authReturn";

function hasControlCharacter(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\x00-\x1f\x7f]/.test(value);
}

/**
 * Allow only product-owned authenticated card targets. This value crosses an
 * external IdP round trip through sessionStorage, so same-origin alone is not
 * sufficient: the final route and all routing identifiers must also validate.
 */
export function isSafeAuthReturnTarget(
  target: string | null,
  origin: string
): target is string {
  if (!target || target[0] !== "/" || hasControlCharacter(target)) return false;
  let url: URL;
  try {
    url = new URL(target, origin);
  } catch {
    return false;
  }
  if (url.origin !== origin || url.hash) return false;

  if (isStandaloneSummaryPath(url.pathname)) {
    return (
      parseStandaloneSummaryTaskId(url.pathname) !== null &&
      parseStandaloneSummarySpaceId(url.search) !== null
    );
  }
  if (url.pathname === "/loop") {
    return parseLoopDeepLink(url.search).kind === "valid";
  }
  return false;
}

export function persistAuthReturnTarget(target?: string): void {
  if (typeof window === "undefined") return;
  let value = target ?? window.location.pathname + window.location.search;
  try {
    // RouteManager adds a tab-scoped sid before Layout renders. It is not part
    // of a card's business target and may point at a session bucket that does
    // not exist after an external IdP returns to the clean /login URL. Persist
    // only the issue/workspace/Space tuple; withAuthReturnSid will reattach the
    // authenticated session's actual sid after login when one exists.
    const url = new URL(value, window.location.origin);
    url.searchParams.delete("sid");
    value = url.pathname + url.search;
    if (isSafeAuthReturnTarget(value, window.location.origin)) {
      window.sessionStorage.setItem(AUTH_RETURN_KEY, value);
    } else {
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
    }
  } catch {
    // Storage can be unavailable in private browsing. The current local-login
    // path still preserves the address bar; only the external IdP bounce loses it.
  }
}

export function consumeAuthReturnTarget(): string | null {
  if (typeof window === "undefined") return null;
  let value: string | null = null;
  try {
    value = window.sessionStorage.getItem(AUTH_RETURN_KEY);
    window.sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    return null;
  }
  return isSafeAuthReturnTarget(value, window.location.origin) ? value : null;
}

export function withAuthReturnSid(
  target: string,
  sid: string | null | undefined
): string {
  if (!sid || typeof window === "undefined") return target;
  try {
    const url = new URL(target, window.location.origin);
    if (url.searchParams.has("sid")) return target;
    url.searchParams.set("sid", sid);
    const value = url.pathname + url.search;
    return isSafeAuthReturnTarget(value, window.location.origin)
      ? value
      : target;
  } catch {
    return target;
  }
}
