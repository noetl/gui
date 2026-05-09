import React, { useState } from "react";
import { Button } from "antd";
import type { AppButtonArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppButton: emits onPressEvent(event.key, event.value) when
// clicked. We map chatui's free-form `variant`/`buttonType` strings onto
// antd Button props (keeping `primary` as the most common case).
const TYPE_MAP: Record<string, "default" | "primary" | "dashed" | "link" | "text"> = {
  default: "default",
  primary: "primary",
  dashed: "dashed",
  link: "link",
  text: "text",
  outlined: "default",
  solid: "primary",
  filled: "primary",
};

export function AppButton({ args, onWidgetEvent }: WidgetProps<AppButtonArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const {
    text = "",
    variant,
    buttonType,
    colorType,
    width,
    disabled,
    forceLoading,
    loadingDelay = 0,
    event,
  } = args || ({} as AppButtonArgs);
  const [loading, setLoading] = useState(false);
  const antdType = TYPE_MAP[buttonType || variant || "default"] || "default";
  const antdDanger = colorType === "danger";

  return (
    <Button
      className="noetl-widget noetl-widget-button"
      type={antdType}
      htmlType="button"
      danger={antdDanger}
      disabled={disabled}
      loading={forceLoading || loading}
      style={width != null ? { width: typeof width === "number" ? `${width}px` : width } : undefined}
      onClick={() => {
        if (event && onWidgetEvent) {
          if (loadingDelay > 0) {
            setLoading(true);
            window.setTimeout(() => setLoading(false), loadingDelay);
          }
          onWidgetEvent({ event: "onPressEvent", key: event.key, value: event.value });
        }
      }}
    >
      {text}
    </Button>
  );
}
