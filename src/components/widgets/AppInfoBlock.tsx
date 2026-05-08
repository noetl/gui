import React from "react";
import { Collapse } from "antd";
import type { AppInfoBlockArgs, WidgetProps } from "./types";

// chatui's AppInfoBlock: an accordion of (title, description) pairs.
// We use antd's Collapse for the same UX without re-rolling the
// chevron / panel layout from scratch.
export function AppInfoBlock({ args }: WidgetProps<AppInfoBlockArgs>) {
  const { items = [] } = args || ({} as AppInfoBlockArgs);
  return (
    <div className="noetl-widget noetl-widget-infoblock">
      <Collapse
        items={items.map((item, index) => ({
          key: `${item.title}-${index}`,
          label: item.title,
          children: <div>{item.description}</div>,
        }))}
      />
    </div>
  );
}
