import path from "node:path";

type UploadExposureOptions = {
  isDevelopment: boolean;
  useLocalStorage: boolean;
};

export function shouldServeSpaFallback(requestPath: string): boolean {
  return !requestPath.startsWith("/api/") && !requestPath.startsWith("/uploads/");
}

export function getProductionStaticDir(cwd: string = process.cwd()): string {
  return path.join(cwd, "dist", "public");
}

export function shouldExposeLocalUploads(options: UploadExposureOptions): boolean {
  return options.useLocalStorage;
}
