import React from "react";
import type { WidgetProps } from "./types";

interface Args {
  source: string;
  lang?: string;
  caption?: string;
}

export function AppCode({ args }: WidgetProps<Args>) {
  const { source = "", lang, caption } = args || ({} as Args);
  return (
    <div className="noetl-widget noetl-widget-code-block">
      {caption && <div className="noetl-widget-code-caption">{caption}</div>}
      <pre className="noetl-widget-code" data-lang={lang || undefined}>
        <code>{source}</code>
      </pre>
    </div>
  );
}
