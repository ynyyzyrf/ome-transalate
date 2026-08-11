import { ENV } from "./_core/env";
import { storagePut } from "./storage";

const DEFAULT_BASE_URL = "https://mineru.net";
const DEFAULT_POLL_INTERVAL_MS = 1500;

type MineruCreateTaskResponse = {
  code?: number;
  msg?: string;
  data?: {
    task_id?: string;
    taskId?: string;
    id?: string;
    file_url?: string;
    fileUrl?: string;
    upload_url?: string;
    uploadUrl?: string;
  };
  task_id?: string;
  taskId?: string;
  file_url?: string;
  fileUrl?: string;
};

type MineruTaskResponse = {
  code?: number;
  msg?: string;
  data?: {
    state?: string;
    full_zip_url?: string;
    markdown_url?: string;
  };
};

export type MineruImageAsset = {
  index: number;
  name: string;
  url: string;
};

export type MineruExtractResult = {
  markdownText: string;
  images: MineruImageAsset[];
};

async function createParseTask(filename: string): Promise<{ taskId: string; uploadUrl: string }> {
  const baseUrl = (ENV.MINERU_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = `${baseUrl}/api/v1/agent/parse/file`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ENV.MINERU_API_KEY) {
    headers.authorization = `Bearer ${ENV.MINERU_API_KEY}`;
    headers["x-api-key"] = ENV.MINERU_API_KEY;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ file_name: filename, enable_formula: false }),
  });

  if (!response.ok) {
    throw new Error(`MinerU create task failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as MineruCreateTaskResponse;
  const taskId =
    json.data?.task_id ||
    json.data?.taskId ||
    json.data?.id ||
    json.task_id ||
    json.taskId;
  const uploadUrl =
    json.data?.file_url ||
    json.data?.fileUrl ||
    json.data?.upload_url ||
    json.data?.uploadUrl ||
    json.file_url ||
    json.fileUrl;
  if (!taskId || !uploadUrl) {
    throw new Error(`MinerU create task response missing task id/upload url: ${JSON.stringify(json).slice(0, 600)}`);
  }

  return { taskId, uploadUrl };
}

async function uploadFileToSignedUrl(uploadUrl: string, buffer: Buffer, mimeType: string): Promise<void> {
  const body = new Uint8Array(buffer);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    // Signed OSS URL expects exact canonical headers; adding content-type may break signature.
    body,
  });

  if (!response.ok) {
    throw new Error(`MinerU upload failed: ${response.status} ${response.statusText}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollTask(taskId: string): Promise<{ markdownUrl: string; fullZipUrl?: string }> {
  const baseUrl = (ENV.MINERU_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const timeoutMs = (ENV.MINERU_TIMEOUT_SECONDS || 120) * 1000;
  const deadline = Date.now() + timeoutMs;
  const headers: Record<string, string> = {};
  if (ENV.MINERU_API_KEY) {
    headers.authorization = `Bearer ${ENV.MINERU_API_KEY}`;
    headers["x-api-key"] = ENV.MINERU_API_KEY;
  }

  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/v1/agent/parse/${taskId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`MinerU poll failed: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as MineruTaskResponse;
    const state = (json.data?.state || "").toLowerCase();

    if (state === "done") {
      const markdownUrl = json.data?.markdown_url;
      if (!markdownUrl) {
        throw new Error("MinerU task completed but markdown_url is empty");
      }
      return { markdownUrl, fullZipUrl: json.data?.full_zip_url };
    }

    if (state === "failed" || state === "error") {
      throw new Error(`MinerU task failed: ${json.msg || "unknown error"}`);
    }

    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  throw new Error(`MinerU task timed out after ${ENV.MINERU_TIMEOUT_SECONDS || 120}s`);
}

function getMimeTypeByName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}

async function extractImagesFromZip(fullZipUrl: string, taskId: string): Promise<MineruImageAsset[]> {
  const zipResp = await fetch(fullZipUrl);
  if (!zipResp.ok) {
    throw new Error(`MinerU full_zip download failed: ${zipResp.status} ${zipResp.statusText}`);
  }
  const zipBuffer = Buffer.from(await zipResp.arrayBuffer());
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(zipBuffer);
  const imageFiles = Object.values(zip.files)
    .filter((f) => !f.dir && /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const uploaded: MineruImageAsset[] = [];
  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    try {
      const bytes = await f.async("uint8array");
      const mime = getMimeTypeByName(f.name);
      const key = `documents/mineru-assets/${taskId}/${i + 1}-${f.name.split("/").pop() || `img-${i + 1}.bin`}`;
      const { url } = await storagePut(key, Buffer.from(bytes), mime);
      uploaded.push({ index: i, name: f.name, url });
    } catch (err) {
      console.error("[MinerU] image upload failed:", f.name, err);
    }
  }
  return uploaded;
}

export async function extractDocumentByMineru(
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<MineruExtractResult> {
  const { taskId, uploadUrl } = await createParseTask(filename);
  await uploadFileToSignedUrl(uploadUrl, buffer, mimeType);
  const { markdownUrl, fullZipUrl } = await pollTask(taskId);

  const response = await fetch(markdownUrl);
  if (!response.ok) {
    throw new Error(`MinerU markdown fetch failed: ${response.status} ${response.statusText}`);
  }
  const markdownText = await response.text();
  let images: MineruImageAsset[] = [];
  if (fullZipUrl) {
    try {
      images = await extractImagesFromZip(fullZipUrl, taskId);
    } catch (err) {
      console.error("[MinerU] extract images failed:", err);
    }
  }
  return { markdownText: markdownText.trim(), images };
}

export async function extractTextByMineru(
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<string> {
  const result = await extractDocumentByMineru(filename, mimeType, buffer);
  return result.markdownText;
}
