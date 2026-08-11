import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "../shared/assetUrls";

describe("resolveAssetUrl", () => {
  it("rewrites local upload paths to the api origin during local development", () => {
    expect(
      resolveAssetUrl("/uploads/courses/manual-images/7/example.png", {
        apiBaseUrl: "",
        currentOrigin: "http://localhost:5173",
      })
    ).toBe("http://localhost:3001/uploads/courses/manual-images/7/example.png");
  });

  it("keeps same-origin asset paths outside local dev", () => {
    expect(
      resolveAssetUrl("/uploads/courses/manual-images/7/example.png", {
        apiBaseUrl: "",
        currentOrigin: "https://app.example.com",
      })
    ).toBe("https://app.example.com/uploads/courses/manual-images/7/example.png");
  });

  it("prefers an explicit api base url when provided", () => {
    expect(
      resolveAssetUrl("/uploads/courses/manual-images/7/example.png", {
        apiBaseUrl: "https://api.example.com",
        currentOrigin: "https://app.example.com",
      })
    ).toBe("https://api.example.com/uploads/courses/manual-images/7/example.png");
  });

  it("leaves absolute asset urls unchanged", () => {
    expect(
      resolveAssetUrl("https://cdn.example.com/image.png", {
        apiBaseUrl: "",
        currentOrigin: "http://localhost:5173",
      })
    ).toBe("https://cdn.example.com/image.png");
  });
});
