import React from "react";
import type { AppColumnArgs, OnWidgetEvent, WidgetProps } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";

// chatui's AppColumn defaults: align=start, justify=start, gap=12.
const ALIGN_MAP: Record<string, React.CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};
const JUSTIFY_MAP: Record<string, React.CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

export function AppColumn({ args, onWidgetEvent }: WidgetProps<AppColumnArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { children = [], gap = 12, align = "start", justify = "start" } = args || ({} as AppColumnArgs);
  return (
    <div
      className="noetl-widget noetl-widget-column"
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        alignItems: ALIGN_MAP[align],
        justifyContent: JUSTIFY_MAP[justify],
      }}
    >
      {children.map((child, index) => (
        <WidgetRenderer key={index} content={child} onWidgetEvent={onWidgetEvent} />
      ))}
    </div>
  );
}
