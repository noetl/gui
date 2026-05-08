import React, { useMemo } from "react";
import { Tooltip } from "antd";
import * as AntdIcons from "@ant-design/icons";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { AppTooltipArgs, WidgetProps } from "./types";

// chatui's AppTooltip wraps an icon with antd's Tooltip. The icon can be
// resolved either by `iconName` (antd icon name) or by passing a ReactNode
// directly — playbook output usually uses `iconName` because that's what
// JSON serialisation can carry.
export function AppTooltip({ args }: WidgetProps<AppTooltipArgs>) {
  const {
    title,
    placement,
    color,
    disabled,
    icon,
    iconName,
    size = 16,
    iconColor,
    textColor,
  } = args || ({} as AppTooltipArgs);

  const ResolvedIcon = useMemo(() => {
    if (icon && typeof icon !== "string") return null; // already a ReactNode
    const lookup = (iconName || icon) as string | undefined;
    if (!lookup) return InfoCircleOutlined;
    const candidate = (AntdIcons as Record<string, unknown>)[lookup];
    return typeof candidate === "function"
      ? (candidate as React.ComponentType<any>)
      : InfoCircleOutlined;
  }, [icon, iconName]);

  const trigger = ResolvedIcon ? (
    <ResolvedIcon style={{ fontSize: size, color: iconColor }} />
  ) : (
    icon as React.ReactNode
  );

  if (disabled) return <span className="noetl-widget noetl-widget-tooltip">{trigger}</span>;
  return (
    <Tooltip
      title={typeof title === "string" ? <span style={{ color: textColor }}>{title}</span> : title}
      placement={placement as any}
      color={color}
    >
      <span className="noetl-widget noetl-widget-tooltip">{trigger}</span>
    </Tooltip>
  );
}
