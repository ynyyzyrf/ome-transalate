import { describe, expect, it } from "vitest";
import {
  getProductionStaticDir,
  shouldExposeLocalUploads,
  shouldServeSpaFallback,
} from "../deployment";
import { resolveLocalStorageMode } from "../../storage";

describe("deployment routing helpers", () => {
  it("serves the SPA fallback for non-api, non-upload routes", () => {
    expect(shouldServeSpaFallback("/")).toBe(true);
    expect(shouldServeSpaFallback("/learn/42")).toBe(true);
    expect(shouldServeSpaFallback("/admin/users")).toBe(true);
  });

  it("skips the SPA fallback for api and upload paths", () => {
    expect(shouldServeSpaFallback("/api/health")).toBe(false);
    expect(shouldServeSpaFallback("/api/trpc/auth.me")).toBe(false);
    expect(shouldServeSpaFallback("/uploads/courses/example.png")).toBe(false);
  });

  it("builds the production static directory under dist/public", () => {
    expect(getProductionStaticDir("C:\\app")).toBe("C:\\app\\dist\\public");
  });

  it("exposes local uploads in development", () => {
    expect(shouldExposeLocalUploads({ isDevelopment: true, useLocalStorage: true })).toBe(true);
  });

  it("exposes local uploads in production when mounted local storage is enabled", () => {
    expect(shouldExposeLocalUploads({ isDevelopment: false, useLocalStorage: true })).toBe(true);
  });

  it("does not expose uploads when cloud storage is active", () => {
    expect(shouldExposeLocalUploads({ isDevelopment: true, useLocalStorage: false })).toBe(false);
    expect(shouldExposeLocalUploads({ isDevelopment: false, useLocalStorage: false })).toBe(false);
  });
});

describe("local storage mode resolution", () => {
  it("uses cloud storage when forge credentials are configured", () => {
    expect(
      resolveLocalStorageMode({
        forgeApiUrl: "https://forge.example.com",
        forgeApiKey: "secret",
        isDevelopment: true,
      })
    ).toBe(false);
  });

  it("uses local storage in development without forge credentials", () => {
    expect(
      resolveLocalStorageMode({
        forgeApiUrl: undefined,
        forgeApiKey: undefined,
        isDevelopment: true,
      })
    ).toBe(true);
  });

  it("uses local storage in production when uploads dir is explicitly configured", () => {
    expect(
      resolveLocalStorageMode({
        forgeApiUrl: undefined,
        forgeApiKey: undefined,
        isDevelopment: false,
        uploadsDir: "/data/uploads",
      })
    ).toBe(true);
  });

  it("defaults to local storage in production when no cloud storage is configured", () => {
    // Deliberate behavior (commit 94bf1b6): without forge credentials the app uses
    // local filesystem storage in every environment so production can run without an
    // external object store. The storage layer logs a warning when this happens.
    expect(
      resolveLocalStorageMode({
        forgeApiUrl: undefined,
        forgeApiKey: undefined,
        isDevelopment: false,
        uploadsDir: undefined,
      })
    ).toBe(true);
  });
});
