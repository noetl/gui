import React from "react";
import type { AppContainerArgs, OnWidgetEvent, WidgetProps } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";

// chatui's AppContainer: padding/margin wrapper around a single child
// widget. Either a uniform number or per-side overrides.
function box(value?: AppContainerArgs["padding"]): {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
} {
  if (value == null) return {};
  if (typeof value === "number") return { top: value, right: value, bottom: value, left: value };
  return value;
}

export function AppContainer({ args, onWidgetEvent }: WidgetProps<AppContainerArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { padding, margin, child } = args || ({} as AppContainerArgs);
  const p = box(padding);
  const m = box(margin);
  const style: React.CSSProperties = {
    paddingTop: p.top, paddingRight: p.right, paddingBottom: p.bottom, paddingLeft: p.left,
    marginTop: m.top, marginRight: m.right, marginBottom: m.bottom, marginLeft: m.left,
  };
  return (
    <div className="noetl-widget noetl-widget-container" style={style}>
      {child && <WidgetRenderer content={child} onWidgetEvent={onWidgetEvent} />}
    </div>
  );
}
