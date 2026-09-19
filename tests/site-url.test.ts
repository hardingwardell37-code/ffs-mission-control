import { describe, expect, it } from "vitest";
import { resolveSiteUrlSync } from "../lib/site-url";

describe("resolveSiteUrlSync", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips trailing slash", () => {
    expect(
      resolveSiteUrlSync({
        NEXT_PUBLIC_SITE_URL: "https://example.com/",
        VERCEL_URL: "ignored.vercel.app",
      }),
    ).toBe("https://example.com");
  });

  it("uses VERCEL_URL when site url unset", () => {
    expect(
      resolveSiteUrlSync({
        NEXT_PUBLIC_SITE_URL: "",
        VERCEL_URL: "my-app.vercel.app",
      }),
    ).toBe("https://my-app.vercel.app");
  });

  it("falls back to Netlify production URL", () => {
    expect(
      resolveSiteUrlSync({
        NEXT_PUBLIC_SITE_URL: "",
        VERCEL_URL: "",
      }),
    ).toBe("https://ffs-mission-control.netlify.app");
  });
});
