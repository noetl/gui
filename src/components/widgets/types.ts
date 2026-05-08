// Widget content contract — adapted from mlflowio/chatui's
// `MessageContent.tsx` dispatcher and the per-widget Props interfaces in
// `references/chatui/src/pages/Main/ChatArea/ChatMessage/MessageContent/AppWidgets/`.
//
// We mirror chatui's discriminator convention literally — every widget is
// `{ type: "app:<name>", args: {...} }`. Field names and shapes match
// chatui exactly so future widget kinds can be ported by copying their
// component into our `widgets/` directory and adding a switch case.
//
// The only NoETL extensions are `app:code`, `app:iframe`, and `app:link` —
// these don't exist in chatui but are useful for terminal-style output
// (code reproductions) and CDN-hosted widget embeds.
//
// Interactive widgets (button, form, dropdown, etc.) emit events through
// the `onWidgetEvent` callback. NoetlPrompt wires that callback to
// `runCommand` so a widget can dispatch prompt commands.

import type { CSSProperties, ReactNode } from "react";

export type WidgetMessageEvent = {
  // Convention from chatui: an emitted event is identified by a name
  // ("onPressEvent", "onChangeEvent", "onDropdownChange", etc.) plus a
  // (key, value) payload. The NoETL adaptation uses a unified shape:
  // every emit is `{ event: name, key, value }`.
  event: string;
  key: string;
  value: unknown;
};

export type OnWidgetEvent = (event: WidgetMessageEvent) => void;

// ---------------------------------------------------------------------------
// chatui-aligned widget kinds
// ---------------------------------------------------------------------------

export interface AppMarkdownArgs {
  text: string;
}

export interface AppTitleArgs {
  text: string;
  size?: number | string;
  color?: string;
  boldness?: number | "normal" | "bold" | "lighter" | "bolder";
  style?: CSSProperties;
}

export interface AppTextArgs {
  title: string;
  message: string;
  titleColor?: string;
}

export interface AppHorizontalLineArgs {
  // No fields — see chatui's <hr/> component.
}

export interface AppPictureArgs {
  imageUrl?: string;
  imageBase64?: string;
  imageType?: string; // jpeg | png | webp | ...
  maxWidth?: number;
  maxHeight?: number;
  altText?: string;
}

export interface AppIconArgs {
  name: string; // antd icon name, e.g. "CalendarOutlined"
  style?: CSSProperties;
  tooltip?: string;
}

export interface AppProfilePictureArgs {
  src?: string;
  alt?: string;
  size?: number;
  rounded?: boolean;
  border?: boolean;
}

export interface AppStatusBarArgs {
  text: string;
  styleKey?: "success" | "error" | "warning" | "info" | "processing" | string;
}

export interface AppAlertArgs {
  message: string;
  variant?: "success" | "error" | "warning" | "info" | "processing";
}

export interface AppTooltipArgs {
  title: ReactNode | string;
  placement?: string;
  color?: string;
  disabled?: boolean;
  icon?: ReactNode | string;
  iconName?: string;
  size?: number;
  iconColor?: string;
  textColor?: string;
}

export interface AppInfoTableArgs {
  data: Record<string, unknown>;
  fields?: Array<{ label: string; key: string }>;
}

export interface AppInfoGridArgs {
  widgets: WidgetContent[];
  border?: boolean;
}

export interface AppGroupedTableArgs {
  groups: Array<{ title: string; data: Array<[string, string]> }>;
}

export interface AppTableArgs {
  size?: "small" | "middle" | "large";
  data: string[][];
}

export interface AppRecordTableArgs {
  columns: Array<{
    title: string;
    dataIndex: string;
    key?: string;
    sorter?: boolean;
    filter?: boolean;
  }>;
  data: Array<Record<string, unknown>>;
  width?: "compact" | "full" | number | string;
  pageSize?: number;
  disableHeader?: boolean;
  showNull?: boolean;
}

export interface AppFileDisplayArgs {
  file:
    | File
    | { name: string; metadata?: { type?: string }; url: string };
}

export interface AppRowArgs {
  children: WidgetContent[];
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

export interface AppColumnArgs {
  children: WidgetContent[];
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

export interface AppContainerArgs {
  padding?:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number };
  margin?:
    | number
    | { top?: number; right?: number; bottom?: number; left?: number };
  child?: WidgetContent;
}

export interface AppCarouselArgs {
  carouselWidth?: number;
  carouselHeight?: number;
  widgets: WidgetContent[];
}

export interface AppExpandableArgs {
  isExpand: boolean;
  minimalContent: WidgetContent;
  fullContent: WidgetContent;
}

export interface AppInfoBlockArgs {
  items: Array<{ title: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Interactive widgets (round-3 wiring; types defined now so playbooks can
// already emit them and the renderer dispatches without falling through to
// "unsupported widget").
// ---------------------------------------------------------------------------

export interface AppButtonArgs {
  text: string;
  variant?: "link" | "text" | "dashed" | "outlined" | "solid" | "filled";
  buttonType?: "link" | "text" | "dashed" | "default" | "primary";
  colorType?: "default" | "primary" | "danger";
  width?: number | string;
  disabled?: boolean;
  forceLoading?: boolean;
  loadingDelay?: number;
  event?: { key: string; value: unknown };
}

export interface AppCalendarArgs {
  event?: { key: string; valueFormat?: string };
  width?: number;
  forceLoading?: boolean;
  loadingDelay?: number;
  firstDate?: string;
  initialDate?: string;
  lastDate?: string;
}

export interface AppDropdownArgs {
  placeholder?: string;
  selectedId?: string;
  selectionVariants: Array<{ id: string; label: string }>;
}

export interface AppRadioArgs {
  title: string;
  selectedId?: string;
  radioValues: Array<{ id: string; label: string }>;
}

export interface AppCheckboxArgs {
  title: string;
  checkboxValues: Array<{ id: string; label: string; defaultChecked?: boolean }>;
}

export interface AppInputArgs {
  title?: string;
  placeholder?: string;
  onChange?: { key: string };
  disabled?: boolean;
}

export interface AppFormFieldDefinition {
  id: string;
  title: string;
  optional?: boolean;
  validation?: "phone" | "email" | "url" | "none";
  placeholder?: string;
  default_value?: string;
}

export interface AppFormButton {
  text: string;
  variant?: AppButtonArgs["variant"];
  colorType?: AppButtonArgs["colorType"];
  event?: { key: string; value?: unknown };
}

export interface AppFormArgs {
  fields: AppFormFieldDefinition[];
  buttons?: AppFormButton[];
}

export interface AppCustomFormArgs {
  fields: AppFormFieldDefinition[][];
  buttons?: AppFormButton[];
  buttonPlacement?: "bottom" | "side";
  revision?: string | number;
  forceResetSignal?: number;
}

export interface AppQuizArgs {
  questionWidth?: number;
  finishText?: string;
  questions: Array<{
    questionId: string;
    questionText: string;
    answers: Array<{ answerId: string; label: string }>;
  }>;
}

export interface AppDragAndDropArgs {
  backgroundColor?: string;
  icon?: ReactNode;
  text?: string;
  width?: string | number;
  height?: string | number;
}

// ---------------------------------------------------------------------------
// NoETL extensions (not in chatui — useful for terminal output and
// CDN-hosted widget embeds).
// ---------------------------------------------------------------------------

export interface AppCodeArgs {
  source: string;
  lang?: string;
  caption?: string;
}

export interface AppIframeArgs {
  url: string;
  sandbox?: string;
  height?: number;
  title?: string;
}

export interface AppLinkArgs {
  href: string;
  label?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Discriminated union — every renderable widget the GUI dispatcher knows.
// ---------------------------------------------------------------------------

export type WidgetContent =
  | { type: "app:markdown"; args: AppMarkdownArgs }
  | { type: "app:title"; args: AppTitleArgs }
  | { type: "app:text"; args: AppTextArgs }
  | { type: "app:horizontalline"; args?: AppHorizontalLineArgs }
  | { type: "app:picture"; args: AppPictureArgs }
  | { type: "app:icon"; args: AppIconArgs }
  | { type: "app:profilepicture"; args: AppProfilePictureArgs }
  | { type: "app:statusbar"; args: AppStatusBarArgs }
  | { type: "app:alert"; args: AppAlertArgs }
  | { type: "app:tooltip"; args: AppTooltipArgs }
  | { type: "app:infotable"; args: AppInfoTableArgs }
  | { type: "app:infogrid"; args: AppInfoGridArgs }
  | { type: "app:grouped_table"; args: AppGroupedTableArgs }
  | { type: "app:table"; args: AppTableArgs }
  | { type: "app:recordtable"; args: AppRecordTableArgs }
  | { type: "app:filedisplay"; args: AppFileDisplayArgs }
  | { type: "app:row"; args: AppRowArgs }
  | { type: "app:column"; args: AppColumnArgs }
  | { type: "app:container"; args: AppContainerArgs }
  | { type: "app:carousel"; args: AppCarouselArgs }
  | { type: "app:expandable"; args: AppExpandableArgs }
  | { type: "app:info_block"; args: AppInfoBlockArgs }
  // interactive
  | { type: "app:button"; args: AppButtonArgs }
  | { type: "app:calendar"; args: AppCalendarArgs }
  | { type: "app:dropdown"; args: AppDropdownArgs }
  | { type: "app:radio"; args: AppRadioArgs }
  | { type: "app:checkbox"; args: AppCheckboxArgs }
  | { type: "app:input"; args: AppInputArgs }
  | { type: "app:form"; args: AppFormArgs }
  | { type: "app:customform"; args: AppCustomFormArgs }
  | { type: "app:quiz"; args: AppQuizArgs }
  | { type: "app:draganddrop"; args: AppDragAndDropArgs }
  // NoETL extensions
  | { type: "app:code"; args: AppCodeArgs }
  | { type: "app:iframe"; args: AppIframeArgs }
  | { type: "app:link"; args: AppLinkArgs }
  // Catch-all for forward compatibility
  | { type: string; args?: Record<string, unknown> };

export interface WidgetProps<TArgs = Record<string, unknown>> {
  args: TArgs;
  onWidgetEvent?: OnWidgetEvent;
}
