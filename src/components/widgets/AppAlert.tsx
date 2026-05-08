import React from "react";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type { AppAlertArgs, WidgetProps } from "./types";

// Mirrors chatui's AppAlert exactly — same variant set, same icon
// mapping, same colour palette. We use the variant's themed colours
// inline rather than antd's `Alert` so cross-version theme drift is
// minimal and the widget renders identically next to its chatui twin.
const VARIANT_STYLES: Record<string, { background: string; color: string; icon: React.ReactNode }> = {
  success: {
    background: "#f6ffed",
    color: "#135200",
    icon: <CheckCircleOutlined />,
  },
  error: {
    background: "#fff2f0",
    color: "#a8071a",
    icon: <CloseCircleOutlined />,
  },
  warning: {
    background: "#fffbe6",
    color: "#735c00",
    icon: <ExclamationCircleOutlined />,
  },
  info: {
    background: "#e6f7ff",
    color: "#1d39c4",
    icon: <InfoCircleOutlined />,
  },
  processing: {
    background: "#e6fffb",
    color: "#08979c",
    icon: <LoadingOutlined spin />,
  },
  default: {
    background: "#fafafa",
    color: "#333",
    icon: <InfoCircleOutlined />,
  },
};

export function AppAlert({ args }: WidgetProps<AppAlertArgs>) {
  const { message = "", variant = "info" } = args || ({} as AppAlertArgs);
  const palette = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  return (
    <div
      className={`noetl-widget noetl-widget-alert noetl-widget-alert-${variant}`}
      style={{
        background: palette.background,
        color: palette.color,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span aria-hidden="true">{palette.icon}</span>
      <span>{message}</span>
    </div>
  );
}
