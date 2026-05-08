import React from "react";
import type { AppRowArgs, OnWidgetEvent, WidgetProps } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";

// chatui's AppRow defaults: align=center, justify=start, gap=12.
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

export function AppRow({ args, onWidgetEvent }: WidgetProps<AppRowArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { children = [], gap = 12, align = "center", justify = "start" } = args || ({} as AppRowArgs);
  return (
    <div
      className="noetl-widget noetl-widget-row"
      style={{
        display: "flex",
        flexDirection: "row",
        gap,
        alignItems: ALIGN_MAP[align],
        justifyContent: JUSTIFY_MAP[justify],
        flexWrap: "wrap",
      }}
    >
      {children.map((child, index) => (
        <WidgetRenderer key={index} content={child} onWidgetEvent={onWidgetEvent} />
      ))}
    </div>
  );
}
