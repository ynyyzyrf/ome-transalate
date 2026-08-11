/** Lazily-loaded image block shared by the source / translation columns. */
export function SegmentImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img src={src} alt={alt} className="w-full h-auto rounded border border-border" loading="lazy" />
  );
}
