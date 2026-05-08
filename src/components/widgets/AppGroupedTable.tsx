import React from "react";
import type { AppGroupedTableArgs, WidgetProps } from "./types";

// chatui's AppGroupedTable: a flat list of (title, [[label, value], ...])
// groups. Each group is its own block with a heading row above its
// label-value pairs.
export function AppGroupedTable({ args }: WidgetProps<AppGroupedTableArgs>) {
  const { groups = [] } = args || ({} as AppGroupedTableArgs);
  return (
    <div className="noetl-widget noetl-widget-grouped-table" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((group, index) => (
        <section key={`${group.title}-${index}`}>
          <header style={{ fontWeight: 600, marginBottom: 4 }}>{group.title}</header>
          <table>
            <tbody>
              {group.data.map(([label, value], rowIndex) => (
                <tr key={`${label}-${rowIndex}`}>
                  <th style={{ textAlign: "left", padding: "2px 12px 2px 0", fontWeight: 500, color: "var(--noetl-fg-muted, #6b7280)" }}>
                    {label}
                  </th>
                  <td style={{ padding: "2px 0" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
