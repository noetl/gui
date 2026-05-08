import React, { useState } from "react";
import { Button } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import type { AppExpandableArgs, OnWidgetEvent, WidgetProps } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";

// chatui's AppExpandable swaps between minimal and full content via a
// toggle. `isExpand` is the initial state; the toggle is purely local.
export function AppExpandable({ args, onWidgetEvent }: WidgetProps<AppExpandableArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { isExpand = false, minimalContent, fullContent } = args || ({} as AppExpandableArgs);
  const [open, setOpen] = useState<boolean>(Boolean(isExpand));
  return (
    <div className="noetl-widget noetl-widget-expandable">
      <WidgetRenderer content={open ? fullContent : minimalContent} onWidgetEvent={onWidgetEvent} />
      <Button
        type="link"
        size="small"
        icon={open ? <UpOutlined /> : <DownOutlined />}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "show less" : "show more"}
      </Button>
    </div>
  );
}
