import React from "react";
import type { AppStatusBarArgs, WidgetProps } from "./types";

// chatui's AppStatusBar uses themed background bands by `styleKey`.
// Same palette as AppAlert minus icons.
const STYLE_MAP: Record<string, { background: string; color: string }> = {
  success: { background: "#f6ffed", color: "#135200" },
  error: { background: "#fff2f0", color: "#a8071a" },
  warning: { background: "#fffbe6", color: "#735c00" },
  info: { background: "#e6f7ff", color: "#1d39c4" },
  processing: { background: "#e6fffb", color: "#08979c" },
};

export function AppStatusBar({ args }: WidgetProps<AppStatusBarArgs>) {
  const { text = "", styleKey = "info" } = args || ({} as AppStatusBarArgs);
  const palette = STYLE_MAP[styleKey] || STYLE_MAP.info;
  return (
    <div
      className={`noetl-widget noetl-widget-statusbar noetl-widget-statusbar-${styleKey}`}
      style={{
        background: palette.background,
        color: palette.color,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 13,
        display: "inline-block",
      }}
    >
      {text}
    </div>
  );
}
