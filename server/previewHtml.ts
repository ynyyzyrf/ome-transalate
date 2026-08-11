import type { IRBlock } from "./documentIr";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBlock(block: IRBlock): string {
  const text = escapeHtml(block.text || "").replaceAll("\n", "<br/>");
  if (block.type === "heading") return `<h3>${text}</h3>`;
  if (block.type === "list") return `<li>${text}</li>`;
  if (block.type === "table") return `<pre class="table">${text}</pre>`;
  if (block.type === "image") {
    const imageUrl = String(block.meta?.imageUrl || "");
    if (!imageUrl) return `<div class="image-placeholder">[image unavailable]</div>`;
    return `<img class="img" src="${escapeHtml(imageUrl)}" loading="lazy" alt="pdf image" />`;
  }
  return `<p>${text}</p>`;
}

export function renderTranslationPreviewHtml(params: {
  title: string;
  language: string;
  sourceBlocks: IRBlock[];
  translatedBlocks: IRBlock[];
}): string {
  const rows = params.sourceBlocks.map((src, idx) => {
    const trg = params.translatedBlocks[idx];
    return `
      <section class="row">
        <div class="col source">${renderBlock(src)}</div>
        <div class="col target">${renderBlock(trg ?? { ...src, text: "" })}</div>
      </section>
    `;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.title)} - ${escapeHtml(params.language)}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    .wrap { max-width: 1200px; margin: 24px auto; padding: 0 16px; }
    .head { margin-bottom: 16px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .col { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    .meta { color: #475569; font-size: 13px; }
    h3 { margin: 0; font-size: 18px; }
    p { margin: 0; line-height: 1.6; white-space: pre-wrap; }
    .table { margin: 0; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f1f5f9; border-radius: 8px; padding: 8px; }
    .image-placeholder { color: #64748b; font-style: italic; }
    .img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; display: block; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>${escapeHtml(params.title)}</h1>
      <div class="meta">Language: ${escapeHtml(params.language)}</div>
    </div>
    ${rows}
  </div>
</body>
</html>`;
}
