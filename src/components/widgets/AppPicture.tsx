import React from "react";
import type { AppPictureArgs, WidgetProps } from "./types";

// Mirrors chatui's AppPicture: supports either an `imageUrl` (preferred)
// or an `imageBase64` payload with `imageType` (jpeg/png/webp/...).
// Falls back to "no image" if neither is provided. `maxWidth`/`maxHeight`
// constrain the rendered size; the underlying img is responsive.
export function AppPicture({ args }: WidgetProps<AppPictureArgs>) {
  const {
    imageUrl,
    imageBase64,
    imageType = "jpeg",
    maxWidth,
    maxHeight,
    altText,
  } = args || ({} as AppPictureArgs);

  const src = imageUrl
    ? imageUrl
    : imageBase64
      ? `data:image/${imageType};base64,${imageBase64}`
      : undefined;
  if (!src) return null;

  return (
    <div className="noetl-widget noetl-widget-picture">
      <img
        src={src}
        alt={altText || "App Picture"}
        loading="lazy"
        style={{
          width: "100%",
          height: "auto",
          maxWidth: maxWidth ? `${maxWidth}px` : undefined,
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          display: "block",
        }}
      />
    </div>
  );
}
