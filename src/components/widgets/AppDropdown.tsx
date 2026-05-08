import React, { useState } from "react";
import { Select } from "antd";
import type { AppDropdownArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppDropdown: a select from `selectionVariants`. Emits
// onDropdownChange("dropdownSelection", selected_id).
export function AppDropdown({ args, onWidgetEvent }: WidgetProps<AppDropdownArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { placeholder, selectedId, selectionVariants = [] } = args || ({} as AppDropdownArgs);
  const [value, setValue] = useState<string | undefined>(selectedId);
  return (
    <Select
      className="noetl-widget noetl-widget-dropdown"
      style={{ minWidth: 200 }}
      placeholder={placeholder}
      value={value}
      options={selectionVariants.map((option) => ({ value: option.id, label: option.label }))}
      onChange={(next) => {
        setValue(next);
        if (onWidgetEvent) {
          onWidgetEvent({ event: "onDropdownChange", key: "dropdownSelection", value: next });
        }
      }}
    />
  );
}
