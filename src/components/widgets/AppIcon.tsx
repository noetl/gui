import React, { useMemo } from "react";
import * as AntdIcons from "@ant-design/icons";
import { Tooltip } from "antd";
import type { AppIconArgs, WidgetProps } from "./types";

// chatui's AppIcon resolves an antd icon by name (e.g. "CalendarOutlined"
// or "CheckCircleFilled"). Unknown names render an empty span instead of
// crashing — same fallback chatui uses.
export function AppIcon({ args }: WidgetProps<AppIconArgs>) {
  const { name, style, tooltip } = args || ({} as AppIconArgs);
  const Icon = useMemo(() => {
    const candidate = (AntdIcons as Record<string, unknown>)[name];
    return typeof candidate === "function" || (typeof candidate === "object" && candidate !== null)
      ? (candidate as React.ComponentType<any>)
      : undefined;
  }, [name]);
  if (!Icon) {
    return <span className="noetl-widget noetl-widget-icon" aria-hidden="true" />;
  }
  const node = <Icon className="noetl-widget noetl-widget-icon" style={style} />;
  return tooltip ? <Tooltip title={tooltip}>{node}</Tooltip> : node;
}
