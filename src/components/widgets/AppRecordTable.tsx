import React, { useMemo } from "react";
import { Table } from "antd";
import type { AppRecordTableArgs, WidgetProps } from "./types";

// chatui's AppRecordTable: a richer Table that can show real headers,
// pagination, sort, and filter UI. We pass the column descriptors
// through to antd directly. Sort is enabled when `sorter: true` and a
// generic string sorter is wired; per-column custom sorters are out of
// scope for round 2.
export function AppRecordTable({ args }: WidgetProps<AppRecordTableArgs>) {
  const {
    columns = [],
    data = [],
    pageSize = 20,
    disableHeader = false,
    showNull = false,
    width,
  } = args || ({} as AppRecordTableArgs);

  const tableColumns = useMemo(
    () =>
      columns.map((column) => ({
        title: column.title,
        dataIndex: column.dataIndex,
        key: column.key || column.dataIndex,
        sorter: column.sorter
          ? (a: Record<string, unknown>, b: Record<string, unknown>) =>
              String(a[column.dataIndex] ?? "").localeCompare(String(b[column.dataIndex] ?? ""))
          : undefined,
        render: (cellValue: unknown) => {
          if (cellValue === null || cellValue === undefined) return showNull ? "(null)" : "";
          if (typeof cellValue === "object") return JSON.stringify(cellValue);
          return String(cellValue);
        },
      })),
    [columns, showNull],
  );

  const dataSource = useMemo(
    () => data.map((record, index) => ({ ...record, __key: index })),
    [data],
  );

  const styleWidth =
    typeof width === "number" ? `${width}px`
    : width === "compact" ? "fit-content"
    : width === "full" ? "100%"
    : width;

  return (
    <div className="noetl-widget noetl-widget-recordtable" style={{ width: styleWidth }}>
      <Table
        columns={tableColumns}
        dataSource={dataSource}
        rowKey="__key"
        size="small"
        showHeader={!disableHeader}
        pagination={data.length > pageSize ? { pageSize } : false}
        bordered
      />
    </div>
  );
}
