import React from "react";
import type { AppTextArgs, WidgetProps } from "./types";

// Mirrors chatui's AppText: a labeled message — `title` (small caps) plus
// `message` body. `titleColor` tints the title only.
export function AppText({ args }: WidgetProps<AppTextArgs>) {
  const { title = "", message = "", titleColor } = args || ({} as AppTextArgs);
  return (
    <div className="noetl-widget noetl-widget-text">
      {title && (
        <div className="noetl-widget-text-title" style={titleColor ? { color: titleColor } : undefined}>
          {title}
        </div>
      )}
      <div className="noetl-widget-text-message">{message}</div>
    </div>
  );
}
