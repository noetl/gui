import React from "react";
import type { WidgetProps } from "./types";

interface Args {
  url: string;
  sandbox?: string;
  height?: number;
  title?: string;
}

// Default sandbox is intentionally restrictive. Playbook authors who need
// pop-ups, top-navigation, or modals must opt in explicitly via `sandbox`.
const DEFAULT_SANDBOX = "allow-scripts allow-same-origin";

export function AppIframe({ args }: WidgetProps<Args>) {
  const { url, sandbox = DEFAULT_SANDBOX, height = 360, title } = args || ({} as Args);
  if (!url) return null;
  return (
    <div className="noetl-widget noetl-widget-iframe">
      <iframe
        src={url}
        title={title || "embedded widget"}
        sandbox={sandbox}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ width: "100%", height: `${height}px`, border: 0 }}
      />
    </div>
  );
}
