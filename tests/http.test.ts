// @vitest-environment node
import { describe, test, expect } from "vitest";

import { MAX_BODY_BYTES, readJsonBody } from "@/lib/http";

function reqWith(body: BodyInit, headers?: Record<string, string>): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("readJsonBody", () => {
  test("happy path — parses a valid JSON body", async () => {
    const res = await readJsonBody(reqWith(JSON.stringify({ a: 1, b: "x" })));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({ a: 1, b: "x" });
  });

  test("invalid JSON returns invalid_json", async () => {
    const res = await readJsonBody(reqWith("not-json{"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("invalid_json");
  });

  test("empty body returns invalid_json", async () => {
    const res = await readJsonBody(reqWith(""));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("invalid_json");
  });

  test("body larger than cap returns too_large (detected mid-stream)", async () => {
    // Build a body > MAX_BODY_BYTES without a pre-set Content-Length header.
    // undici sets Content-Length automatically, so this also exercises the
    // cheap Content-Length early reject.
    const huge = "x".repeat(MAX_BODY_BYTES + 1);
    const body = JSON.stringify({ junk: huge });
    const res = await readJsonBody(reqWith(body));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("too_large");
  });

  test("body at exactly the cap is accepted", async () => {
    // Construct a JSON body whose byte length is exactly MAX_BODY_BYTES.
    const prefix = '{"junk":"';
    const suffix = '"}';
    const fillerLen = MAX_BODY_BYTES - prefix.length - suffix.length;
    const body = prefix + "y".repeat(fillerLen) + suffix;
    expect(body.length).toBe(MAX_BODY_BYTES);
    const res = await readJsonBody(reqWith(body));
    expect(res.ok).toBe(true);
  });
});
