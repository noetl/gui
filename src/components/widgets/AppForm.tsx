import React, { useMemo, useState } from "react";
import { Form, Input, Button, Space } from "antd";
import type { AppFormArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppForm: simple linear form with per-field client-side
// validation (phone | email | url | none). Buttons emit their custom
// `event.key` payload on submit; the unnamed default button submits the
// whole form as a single { fieldId: value } object.
const VALIDATION_RULES: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  phone: /^\+?\d[\d\s\-()]{6,}$/,
};

export function AppForm({ args, onWidgetEvent }: WidgetProps<AppFormArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { fields = [], buttons = [{ text: "Submit" }] } = args || ({} as AppFormArgs);
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((field) => [field.id, field.default_value || ""])),
  );
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const field of fields) {
      const value = values[field.id] || "";
      if (!field.optional && !value) out[field.id] = "required";
      else if (field.validation && field.validation !== "none" && value) {
        const rule = VALIDATION_RULES[field.validation];
        if (rule && !rule.test(value)) out[field.id] = `invalid ${field.validation}`;
      }
    }
    return out;
  }, [fields, values]);
  const valid = Object.keys(errors).length === 0;

  return (
    <div className="noetl-widget noetl-widget-form">
      <Form layout="vertical">
        {fields.map((field) => (
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
      </Form>
    </div>
  );
}
