type ImageLikeBlock = {
  type?: string | null;
  text?: string | null;
};

export function isImagePlaceholderText(text?: string | null): boolean {
  return String(text || "").trim().toUpperCase() === "[IMAGE]";
}

export function isImageLikeBlock(block?: ImageLikeBlock | null): boolean {
  if (!block) return false;
  return block.type === "image" || isImagePlaceholderText(block.text);
}
