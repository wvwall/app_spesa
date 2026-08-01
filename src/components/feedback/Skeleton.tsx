import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}

/** Blocco shimmer generico per gli stati di primo caricamento (vedi index.css per l'animazione). */
export function Skeleton({ width = "100%", height = 14, radius = 6, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className="skeleton-shimmer"
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}
