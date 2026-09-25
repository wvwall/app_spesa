import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}

/** Generic shimmer block for initial loading states (see index.css for the animation). */
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
