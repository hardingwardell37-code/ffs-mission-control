import { describe, expect, it } from "vitest";
import {
  extFromMime,
  generatedObjectPath,
  isImageAsset,
  isVideoAsset,
} from "../lib/storage/campaign-assets";

describe("campaign-assets storage helpers", () => {
  it("maps mime types to extensions", () => {
    expect(extFromMime("image/png")).toBe("png");
    expect(extFromMime("image/jpeg")).toBe("jpg");
    expect(extFromMime("video/mp4")).toBe("mp4");
    expect(extFromMime("image/weird")).toBe("png");
    expect(extFromMime(null, "mp4")).toBe("mp4");
  });

  it("builds durable generated object paths", () => {
    expect(generatedObjectPath("camp", "job", "image/png")).toBe("generated/camp/job.png");
    expect(generatedObjectPath("camp", "job", "video/mp4")).toBe("generated/camp/job.mp4");
  });

  it("detects image vs video for previews", () => {
    expect(isImageAsset("image/png", null)).toBe(true);
    expect(isImageAsset(null, "https://cdn.example/out.webp")).toBe(true);
    expect(isVideoAsset("video/mp4", null)).toBe(true);
    expect(isVideoAsset(null, "https://cdn.example/clip.mp4")).toBe(true);
    expect(isImageAsset("application/octet-stream", "https://cdn.example/file.bin")).toBe(false);
  });
});
