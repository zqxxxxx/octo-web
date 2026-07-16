// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_RETURN_KEY,
  consumeAuthReturnTarget,
  isSafeAuthReturnTarget,
  persistAuthReturnTarget,
  withAuthReturnSid,
} from "./authReturn";

const ISSUE_ID = "10000000-0000-4000-8000-000000000001";
const WORKSPACE_ID = "20000000-0000-4000-8000-000000000002";

beforeEach(() => window.sessionStorage.clear());

describe("authenticated card return target", () => {
  it("accepts only complete Summary and Loop card routes", () => {
    expect(
      isSafeAuthReturnTarget("/s/42?sp=space_9", window.location.origin)
    ).toBe(true);
    expect(
      isSafeAuthReturnTarget(
        `/loop?issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}&sp=space_9`,
        window.location.origin
      )
    ).toBe(true);

    for (const invalid of [
      "/s/42",
      "/s/42?sp=../../other",
      `/loop?issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}`,
      "//evil.example/loop",
      "/\nevil.example/loop",
      "/settings",
    ]) {
      expect(isSafeAuthReturnTarget(invalid, window.location.origin)).toBe(
        false
      );
    }
  });

  it("persists, validates, and consumes exactly once", () => {
    persistAuthReturnTarget("/s/42?sp=space_9");
    expect(window.sessionStorage.getItem(AUTH_RETURN_KEY)).toBe(
      "/s/42?sp=space_9"
    );
    expect(consumeAuthReturnTarget()).toBe("/s/42?sp=space_9");
    expect(consumeAuthReturnTarget()).toBeNull();
  });

  it("does not persist RouteManager's transient sid as card identity", () => {
    persistAuthReturnTarget(
      `/loop?issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}&sp=space_9&sid=old-tab`
    );
    expect(window.sessionStorage.getItem(AUTH_RETURN_KEY)).toBe(
      `/loop?issue=${ISSUE_ID}&workspace=${WORKSPACE_ID}&sp=space_9`
    );
  });

  it("clears a tampered target instead of redirecting", () => {
    window.sessionStorage.setItem(
      AUTH_RETURN_KEY,
      "https://evil.example/steal"
    );
    expect(consumeAuthReturnTarget()).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull();
  });

  it("carries the authenticated sid without changing the target route", () => {
    expect(withAuthReturnSid("/s/42?sp=space_9", "a&b")).toBe(
      "/s/42?sp=space_9&sid=a%26b"
    );
  });
});
