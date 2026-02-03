import { describe, expect, it } from "vitest";
import { safeExternalHref, validateSameOrigin } from "@/lib/security";

describe("safeExternalHref", () => {
  it("allows https/http URLs", () => {
    expect(safeExternalHref("https://example.com/path?x=1")).toBe("https://example.com/path?x=1");
    expect(safeExternalHref("http://example.com/")).toBe("http://example.com/");
  });

  it("rejects non-http(s) schemes", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(safeExternalHref("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBeNull();
  });

  it("rejects invalid or empty inputs", () => {
    expect(safeExternalHref("")).toBeNull();
    expect(safeExternalHref("not a url")).toBeNull();
  });
});

describe("validateSameOrigin", () => {
  it("rejects requests without Origin", () => {
    const req = new Request("https://example.com/api/test", { method: "POST" });
    expect(validateSameOrigin(req)).toEqual({ ok: false, error: "Missing Origin." });
  });

  it("rejects invalid Origin", () => {
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { origin: "not a url", "x-forwarded-host": "example.com" },
    });
    expect(validateSameOrigin(req)).toEqual({ ok: false, error: "Invalid Origin." });
  });

  it("rejects cross-origin requests", () => {
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { origin: "https://evil.example", "x-forwarded-host": "example.com" },
    });
    expect(validateSameOrigin(req)).toEqual({ ok: false, error: "Cross-origin request blocked." });
  });

  it("accepts same-origin requests", () => {
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { origin: "https://example.com", "x-forwarded-host": "example.com" },
    });
    expect(validateSameOrigin(req)).toEqual({ ok: true });
  });
});

