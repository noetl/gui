import React, { useEffect, useMemo, useState } from "react";
import { Form, Input, Button, Space } from "antd";
import type { AppCustomFormArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppCustomForm: multi-column form (2D `fields` array) with
// the same regex validation as AppForm. `revision` / `forceResetSignal`
// trigger a state reset so external playbook updates can clear input.
const VALIDATION_RULES: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  phone: /^\+?\d[\d\s\-()]{6,}$/,
};

export function AppCustomForm({ args, onWidgetEvent }: WidgetProps<AppCustomFormArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const {
    fields = [],
    buttons = [{ text: "Submit" }],
    buttonPlacement = "bottom",
    revision,
    forceResetSignal,
  } = args || ({} as AppCustomFormArgs);

  const flatFields = useMemo(() => fields.flat(), [fields]);
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(flatFields.map((field) => [field.id, field.default_value || ""])),
  );

  // chatui resets input when revision/forceResetSignal change.
  useEffect(() => {
    setValues(Object.fromEntries(flatFields.map((field) => [field.id, field.default_value || ""])));
  }, [revision, forceResetSignal, flatFields]);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const field of flatFields) {
      const value = values[field.id] || "";
      if (!field.optional && !value) out[field.id] = "required";
      else if (field.validation && field.validation !== "none" && value) {
        const rule = VALIDATION_RULES[field.validation];
        if (rule && !rule.test(value)) out[field.id] = `invalid ${field.validation}`;
      }
    }
    return out;
  }, [flatFields, values]);
  const valid = Object.keys(errors).length === 0;

  const buttonRow = (
    <Space>
      {buttons.map((button, index) => (
        <Button
          key={index}
          type={button.colorType === "primary" ? "primary" : "default"}
          danger={button.colorType === "danger"}
          disabled={!valid}
          onClick={() => {
            if (!onWidgetEvent) return;
            const eventName = button.event?.key || "onFormSubmit";
            onWidgetEvent({ event: "onFormSubmit", key: eventName, value: button.event?.value ?? values });
          }}
        >
          {button.text}
        </Button>
      ))}
    </Space>
  );

  return (
    <div className="noetl-widget noetl-widget-customform" style={{ display: "flex", flexDirection: buttonPlacement === "side" ? "row" : "column", gap: 16 }}>
      <Form layout="vertical" style={{ flex: 1 }}>
        {fields.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: "grid", gridTemplateColumns: `repeat(${row.length}, 1fr)`, gap: 12 }}>
            {row.map((field) => (
              <Form.Item
                key={field.id}
                label={field.title + (field.optional ? "" : " *")}
                validateStatus={errors[field.id] ? "error" : undefined}
                help={errors[field.id]}
              >
                <Input
                  placeholder={field.placeholder}
                  value={values[field.id] || ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                />
              </Form.Item>
            ))}
          </div>
        ))}
        {buttonPlacement === "bottom" && buttonRow}
      </Form>
      {buttonPlacement === "side" && <div style={{ alignSelf: "flex-end" }}>{buttonRow}</div>}
    </div>
  );
}
