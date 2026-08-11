// Storage helpers: local filesystem in dev, cloud proxy in production/test.

import { existsSync, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ENV } from "./_core/env";

type StorageConfig = { baseUrl: string; apiKey: string };

type LocalStorageModeOptions = {
  forgeApiUrl?: string;
  forgeApiKey?: string;
  isDevelopment: boolean;
  uploadsDir?: string;
};

const LOCAL_UPLOADS_DIR = ENV.UPLOADS_DIR || join(process.cwd(), "server", "uploads");

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const segmentStart = relKey.lastIndexOf("/");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1 || lastDot <= segmentStart) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as BlobPart], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

async function cloudPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  const url = (await response.json()).url;
  return { key, url };
}

async function cloudGet(relKey: string): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

async function localPut(
  relKey: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const filePath = join(LOCAL_UPLOADS_DIR, key);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const buffer =
    typeof data === "string"
      ? Buffer.from(data, "utf-8")
      : data instanceof Uint8Array
        ? Buffer.from(data)
        : data;

  const writeStream = createWriteStream(filePath);
  await new Promise<void>((resolve, reject) => {
    writeStream.write(buffer, err => {
      if (err) {
        reject(err);
        return;
      }
      writeStream.end(() => resolve());
    });
  });

  return { key, url: `/uploads/${key}` };
}

async function localGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

export function resolveLocalStorageMode(options: LocalStorageModeOptions): boolean {
  // Priority: explicit cloud config takes precedence
  if (options.forgeApiUrl && options.forgeApiKey) return false;
  // Without cloud config, prefer local storage in all environments
  // This allows production deployments to work without external storage services
  return true;
}

function useLocalStorage(): boolean {
  const local = resolveLocalStorageMode({
    forgeApiUrl: ENV.forgeApiUrl,
    forgeApiKey: ENV.forgeApiKey,
    isDevelopment: ENV.isDevelopment,
    uploadsDir: ENV.UPLOADS_DIR,
  });
  if (local && !ENV.isDevelopment) {
    console.warn(
      "[storage] No object storage configured (FORGE_API_URL/FORGE_API_KEY); using the local filesystem in production. " +
        "Uploads are stored on container-local disk and may be lost across restarts or replicas.",
    );
  }
  return local;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (useLocalStorage()) {
    return localPut(relKey, data);
  }
  return cloudPut(relKey, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  if (useLocalStorage()) {
    return localGet(relKey);
  }
  return cloudGet(relKey);
}

export function getLocalUploadsDir(): string {
  return LOCAL_UPLOADS_DIR;
}
