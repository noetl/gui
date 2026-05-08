import React from "react";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import type { AppCalendarArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppCalendar: a date picker with optional `firstDate` /
// `lastDate` bounds. Emits onChangeEvent with the formatted string.
// We use antd's DatePicker; antd ships dayjs as a peer dep so we can
// rely on it without adding a new package.
export function AppCalendar({ args, onWidgetEvent }: WidgetProps<AppCalendarArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const {
    event,
    width,
    firstDate,
    initialDate,
    lastDate,
  } = args || ({} as AppCalendarArgs);

  const valueFormat = event?.valueFormat || "YYYY-MM-DD";
  const initial = initialDate ? dayjs(initialDate) : undefined;
  const minDate = firstDate ? dayjs(firstDate) : undefined;
  const maxDate = lastDate ? dayjs(lastDate) : undefined;

  return (
    <DatePicker
      className="noetl-widget noetl-widget-calendar"
      defaultValue={initial}
      style={{ width: typeof width === "number" ? `${width}px` : width }}
      disabledDate={(current: Dayjs) => {
        if (!current) return false;
        if (minDate && current.isBefore(minDate, "day")) return true;
        if (maxDate && current.isAfter(maxDate, "day")) return true;
        return false;
      }}
      onChange={(value) => {
        if (!event || !onWidgetEvent) return;
        onWidgetEvent({
          event: "onChangeEvent",
          key: event.key,
          value: value ? value.format(valueFormat) : null,
        });
      }}
    />
  );
}
