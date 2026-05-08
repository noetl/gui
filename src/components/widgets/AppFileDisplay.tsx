import React from "react";
import { FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { Button } from "antd";
import type { AppFileDisplayArgs, WidgetProps } from "./types";

// chatui's AppFileDisplay: small file card with name, type, and a
// download button. Accepts either a real `File` (with browser-side
// blob URL) or a plain object with a `url` field, which is what
// playbooks emit.
function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export function AppFileDisplay({ args }: WidgetProps<AppFileDisplayArgs>) {
  const { file } = args || ({} as AppFileDisplayArgs);
  if (!file) return null;
  const name = isFile(file) ? file.name : file.name;
  const type = isFile(file) ? file.type : (file as any).metadata?.type;
  const url = isFile(file) ? URL.createObjectURL(file) : (file as any).url;
  return (
    <div
      className="noetl-widget noetl-widget-filedisplay"
      style={{
        display: "inline-flex",
        gap: 12,
        padding: "8px 12px",
        border: "1px solid var(--noetl-border, #e5e7eb)",
        borderRadius: 8,
        alignItems: "center",
      }}
    >
      <FileOutlined style={{ fontSize: 24 }} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
        <span style={{ fontWeight: 600 }}>{name}</span>
        {type && <small style={{ color: "var(--noetl-fg-muted, #6b7280)" }}>{type}</small>}
      </div>
      {url && (
        <Button
          icon={<DownloadOutlined />}
          size="small"
          href={url}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
        >
          Download
        </Button>
      )}
    </div>
  );
}
