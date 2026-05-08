import React from "react";
import type { AppTitleArgs, WidgetProps } from "./types";

// chatui's AppTitle accepts `size`, `color`, `boldness`, and an open
// `style` map. We apply them inline so playbook authors get pixel-level
// control without a separate CSS roundtrip.
export function AppTitle({ args }: WidgetProps<AppTitleArgs>) {
  const { text = "", size, color, boldness, style } = args || ({} as AppTitleArgs);
  const css: React.CSSProperties = {
    ...(size != null ? { fontSize: typeof size === "number" ? `${size}px` : size } : {}),
    ...(color ? { color } : {}),
    ...(boldness != null ? { fontWeight: boldness as React.CSSProperties["fontWeight"] } : {}),
    ...(style || {}),
  };
  return <div className="noetl-widget noetl-widget-title" style={css}>{text}</div>;
}
