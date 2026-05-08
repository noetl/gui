import React, { useMemo } from "react";
import { Table } from "antd";
import type { AppTableArgs, WidgetProps } from "./types";

// Mirrors chatui's AppTable: takes a 2D string array as `data`, auto-
// generates `Column1..ColumnN` headers, header is hidden by default, and
// pagination is off. `size` controls antd Table density (small/middle/large).
export function AppTable({ args }: WidgetProps<AppTableArgs>) {
  const { size = "small", data = [] } = args || ({} as AppTableArgs);
  const columnCount = data[0]?.length || 0;

  const columns = useMemo(
    () =>
      Array.from({ length: columnCount }, (_, index) => ({
        title: `Column${index + 1}`,
        dataIndex: `Column${index + 1}`,
        key: `Column${index + 1}`,
      })),
    [columnCount],
  );

  const dataSource = useMemo(
    () =>
      data.map((row, rowIndex) => {
        const record: Record<string, unknown> = { id: rowIndex };
        row.forEach((cell, columnIndex) => {
          record[`Column${columnIndex + 1}`] = cell;
        });
        return record;
      }),
    [data],
  );

  return (
    <div className="noetl-widget noetl-widget-table">
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        size={size}
        pagination={false}
        showHeader={false}
        bordered
      />
    </div>
  );
}
