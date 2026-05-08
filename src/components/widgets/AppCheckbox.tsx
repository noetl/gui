import React, { useState } from "react";
import { Checkbox, Space } from "antd";
import type { AppCheckboxArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppCheckbox: multi-select. Emits
// onCheckboxChange("checkboxSelection", string[]).
export function AppCheckbox({ args, onWidgetEvent }: WidgetProps<AppCheckboxArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { title, checkboxValues = [] } = args || ({} as AppCheckboxArgs);
  const initial = checkboxValues.filter((option) => option.defaultChecked).map((option) => option.id);
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <div className="noetl-widget noetl-widget-checkbox">
      {title && <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>}
      <Checkbox.Group
        value={selected}
        onChange={(next) => {
          const list = (next as Array<string | number>).map((value) => String(value));
          setSelected(list);
          if (onWidgetEvent) {
            onWidgetEvent({ event: "onCheckboxChange", key: "checkboxSelection", value: list });
          }
        }}
      >
        <Space direction="vertical">
          {checkboxValues.map((option) => (
            <Checkbox key={option.id} value={option.id}>
              {option.label}
            </Checkbox>
          ))}
        </Space>
      </Checkbox.Group>
    </div>
  );
}
