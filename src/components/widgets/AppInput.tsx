import React from "react";
import { Input } from "antd";
import type { AppInputArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppInput: text field. Emits onInputChange(onChange.key, value)
// when configured.
export function AppInput({ args, onWidgetEvent }: WidgetProps<AppInputArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { title, placeholder, onChange, disabled } = args || ({} as AppInputArgs);
  return (
    <div className="noetl-widget noetl-widget-input">
      {title && <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>}
      <Input
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          if (!onChange?.key || !onWidgetEvent) return;
          onWidgetEvent({ event: "onInputChange", key: onChange.key, value: event.target.value });
        }}
      />
    </div>
  );
}
