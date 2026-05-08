import React from "react";
import type { AppInfoGridArgs, OnWidgetEvent, WidgetProps } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";

// chatui's AppInfoGrid: render a list of nested widgets as a 2-column
// grid with optional cell borders. Child widget shapes are full
// `WidgetContent` values, recursed through WidgetRenderer.
export function AppInfoGrid({ args, onWidgetEvent }: WidgetProps<AppInfoGridArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { widgets = [], border = false } = args || ({} as AppInfoGridArgs);
  return (
    <div
      className="noetl-widget noetl-widget-infogrid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 8,
      }}
    >
      {widgets.map((widget, index) => (
        <div
          key={index}
          style={{
            border: border ? "1px solid var(--noetl-border, #e5e7eb)" : "none",
            borderRadius: border ? 6 : 0,
            padding: border ? 8 : 0,
          }}
        >
          <WidgetRenderer content={widget} onWidgetEvent={onWidgetEvent} />
        </div>
      ))}
    </div>
  );
}
