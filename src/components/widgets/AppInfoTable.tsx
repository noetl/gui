import React from "react";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import type { AppInfoTableArgs, WidgetProps } from "./types";

// chatui's AppInfoTable: render a record as a label-value list. If
// `fields` is provided, only the listed keys appear and respect the
// label override; otherwise every entry in `data` is shown with the
// raw key as label. Booleans render as a check / cross icon.
function renderValue(value: unknown): React.ReactNode {
  if (typeof value === "boolean") {
    return value ? (
      <CheckOutlined aria-label="true" style={{ color: "#52c41a" }} />
    ) : (
      <CloseOutlined aria-label="false" style={{ color: "#ff4d4f" }} />
    );
  }
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AppInfoTable({ args }: WidgetProps<AppInfoTableArgs>) {
  const { data = {}, fields } = args || ({} as AppInfoTableArgs);
  const rows = fields
    ? fields.map((field) => ({ label: field.label, value: (data as Record<string, unknown>)[field.key] }))
    : Object.entries(data).map(([key, value]) => ({ label: key, value }));
  return (
    <div className="noetl-widget noetl-widget-infotable">
      <table>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`}>
              <th style={{ textAlign: "left", padding: "4px 12px 4px 0", fontWeight: 600, color: "var(--noetl-fg-muted, #6b7280)" }}>
                {row.label}
              </th>
              <td style={{ padding: "4px 0" }}>{renderValue(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
