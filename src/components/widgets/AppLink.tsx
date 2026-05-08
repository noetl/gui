import React from "react";
import type { WidgetProps } from "./types";

interface Args {
  href: string;
  label?: string;
  description?: string;
}

export function AppLink({ args }: WidgetProps<Args>) {
  const { href, label, description } = args || ({} as Args);
  if (!href) return null;
  return (
    <div className="noetl-widget noetl-widget-link">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label || href}
      </a>
      {description && <div className="noetl-widget-link-description">{description}</div>}
    </div>
  );
}
