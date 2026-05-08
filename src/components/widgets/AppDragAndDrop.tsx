import React, { useRef, useState } from "react";
import { CloudUploadOutlined } from "@ant-design/icons";
import type { AppDragAndDropArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppDragAndDrop: drop zone for file upload. Emits a
// DROP_EVENT carrying a JSON-stringified [{ name, type }] payload —
// chatui side then uses the actual files via a separate browser-API
// path.
export function AppDragAndDrop({ args, onWidgetEvent }: WidgetProps<AppDragAndDropArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { backgroundColor, icon, text = "Drop files here", width = "100%", height = 120 } = args || ({} as AppDragAndDropArgs);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fire = (files: FileList | null) => {
    if (!files || files.length === 0 || !onWidgetEvent) return;
    const payload = Array.from(files).map((file) => ({ name: file.name, type: file.type }));
    onWidgetEvent({ event: "DROP_EVENT", key: "dragAndDrop", value: JSON.stringify(payload) });
  };

  return (
    <div
      className="noetl-widget noetl-widget-draganddrop"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        background: hover ? "var(--noetl-surface-hover, #f3f4f6)" : (backgroundColor || "var(--noetl-surface-2, #fafafa)"),
        border: `2px dashed ${hover ? "var(--noetl-accent, #1d39c4)" : "var(--noetl-border, #d1d5db)"}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => { event.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(event) => {
        event.preventDefault();
        setHover(false);
        fire(event.dataTransfer?.files || null);
      }}
    >
      {icon || <CloudUploadOutlined style={{ fontSize: 28 }} />}
      <div>{text}</div>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(event) => fire(event.target.files)}
      />
    </div>
  );
}
