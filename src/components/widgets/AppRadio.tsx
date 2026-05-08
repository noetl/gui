import React, { useState } from "react";
import { Radio, Space } from "antd";
import type { AppRadioArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppRadio: single-select from `radioValues`. Emits
// onRadioSelect("radioSelection", selected_id).
export function AppRadio({ args, onWidgetEvent }: WidgetProps<AppRadioArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { title, selectedId, radioValues = [] } = args || ({} as AppRadioArgs);
  const [value, setValue] = useState<string | undefined>(selectedId);
  return (
    <div className="noetl-widget noetl-widget-radio">
      {title && <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>}
      <Radio.Group
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (onWidgetEvent) {
            onWidgetEvent({ event: "onRadioSelect", key: "radioSelection", value: next });
          }
        }}
      >
        <Space direction="vertical">
          {radioValues.map((option) => (
            <Radio key={option.id} value={option.id}>
              {option.label}
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </div>
  );
}
