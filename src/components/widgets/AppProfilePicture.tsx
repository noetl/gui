import React from "react";
import { UserOutlined } from "@ant-design/icons";
import type { AppProfilePictureArgs, WidgetProps } from "./types";

// chatui's AppProfilePicture: round/rounded avatar with optional border.
// Falls back to a neutral user-glyph if `src` is missing.
export function AppProfilePicture({ args }: WidgetProps<AppProfilePictureArgs>) {
  const { src, alt = "profile picture", size = 48, rounded = true, border = false } = args || ({} as AppProfilePictureArgs);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: rounded ? "50%" : 4,
    border: border ? "1px solid var(--noetl-border, #e5e7eb)" : "none",
    objectFit: "cover",
    background: "var(--noetl-surface-2, #f3f4f6)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--noetl-fg-muted, #6b7280)",
  };
  if (src) {
    return <img className="noetl-widget noetl-widget-profilepicture" src={src} alt={alt} style={style} />;
  }
  return (
    <span className="noetl-widget noetl-widget-profilepicture" style={style} aria-label={alt}>
      <UserOutlined />
    </span>
  );
}
