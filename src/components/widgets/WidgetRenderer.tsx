import React from "react";
import type { OnWidgetEvent, WidgetContent } from "./types";
import { AppMarkdown } from "./AppMarkdown";
import { AppText } from "./AppText";
import { AppTitle } from "./AppTitle";
import { AppHorizontalLine } from "./AppHorizontalLine";
import { AppPicture } from "./AppPicture";
import { AppIcon } from "./AppIcon";
import { AppProfilePicture } from "./AppProfilePicture";
import { AppStatusBar } from "./AppStatusBar";
import { AppAlert } from "./AppAlert";
import { AppTooltip } from "./AppTooltip";
import { AppInfoTable } from "./AppInfoTable";
import { AppInfoGrid } from "./AppInfoGrid";
import { AppGroupedTable } from "./AppGroupedTable";
import { AppTable } from "./AppTable";
import { AppRecordTable } from "./AppRecordTable";
import { AppFileDisplay } from "./AppFileDisplay";
import { AppRow } from "./AppRow";
import { AppColumn } from "./AppColumn";
import { AppContainer } from "./AppContainer";
import { AppCarousel } from "./AppCarousel";
import { AppExpandable } from "./AppExpandable";
import { AppInfoBlock } from "./AppInfoBlock";
import { AppButton } from "./AppButton";
import { AppCalendar } from "./AppCalendar";
import { AppDropdown } from "./AppDropdown";
import { AppRadio } from "./AppRadio";
import { AppCheckbox } from "./AppCheckbox";
import { AppInput } from "./AppInput";
import { AppForm } from "./AppForm";
import { AppCustomForm } from "./AppCustomForm";
import { AppQuiz } from "./AppQuiz";
import { AppDragAndDrop } from "./AppDragAndDrop";
import { AppCode } from "./AppCode";
import { AppIframe } from "./AppIframe";
import { AppLink } from "./AppLink";

// Mirrors mlflowio/chatui's MessageContent.tsx switch dispatcher
// (registered read-only at references/chatui). For each `type` value we
// dispatch to the matching App<Kind> component; unknown kinds fall
// through to a small "unsupported widget" surface that still shows the
// JSON so playbook authors can debug.

interface WidgetRendererProps {
  content?: WidgetContent | null;
  onWidgetEvent?: OnWidgetEvent;
}

interface BoundaryState {
  error?: Error;
}

class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.warn("[WidgetRenderer] widget threw:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

function UnsupportedWidget({ content }: { content?: WidgetContent | null }) {
  return (
    <div className="noetl-widget noetl-widget-unsupported">
      <div className="noetl-widget-unsupported-title">unsupported widget: {content?.type ?? "(missing type)"}</div>
      <pre className="noetl-widget-code">
        <code>{JSON.stringify(content ?? {}, null, 2)}</code>
      </pre>
    </div>
  );
}

function WidgetRendererInner({ content, onWidgetEvent }: WidgetRendererProps) {
  if (!content || typeof content !== "object") return null;
  const widgetType = (content as { type?: string }).type;
  const argsAny = (content as any).args;
  switch (widgetType) {
    // Read-only / display
    case "app:markdown":
      return <AppMarkdown args={argsAny} />;
    case "app:text":
      return <AppText args={argsAny} />;
    case "app:title":
      return <AppTitle args={argsAny} />;
    case "app:horizontalline":
      return <AppHorizontalLine />;
    case "app:picture":
      return <AppPicture args={argsAny} />;
    case "app:icon":
      return <AppIcon args={argsAny} />;
    case "app:profilepicture":
      return <AppProfilePicture args={argsAny} />;
    case "app:statusbar":
      return <AppStatusBar args={argsAny} />;
    case "app:alert":
      return <AppAlert args={argsAny} />;
    case "app:tooltip":
      return <AppTooltip args={argsAny} />;
    case "app:infotable":
      return <AppInfoTable args={argsAny} />;
    case "app:infogrid":
      return <AppInfoGrid args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:grouped_table":
      return <AppGroupedTable args={argsAny} />;
    case "app:table":
      return <AppTable args={argsAny} />;
    case "app:recordtable":
      return <AppRecordTable args={argsAny} />;
    case "app:filedisplay":
      return <AppFileDisplay args={argsAny} />;
    // Layout / containers
    case "app:row":
      return <AppRow args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:column":
      return <AppColumn args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:container":
      return <AppContainer args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:carousel":
      return <AppCarousel args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:expandable":
      return <AppExpandable args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:info_block":
      return <AppInfoBlock args={argsAny} />;
    // Interactive
    case "app:button":
      return <AppButton args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:calendar":
      return <AppCalendar args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:dropdown":
      return <AppDropdown args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:radio":
      return <AppRadio args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:checkbox":
      return <AppCheckbox args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:input":
      return <AppInput args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:form":
      return <AppForm args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:customform":
      return <AppCustomForm args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:quiz":
      return <AppQuiz args={argsAny} onWidgetEvent={onWidgetEvent} />;
    case "app:draganddrop":
      return <AppDragAndDrop args={argsAny} onWidgetEvent={onWidgetEvent} />;
    // NoETL extensions
    case "app:code":
      return <AppCode args={argsAny} />;
    case "app:iframe":
      return <AppIframe args={argsAny} />;
    case "app:link":
      return <AppLink args={argsAny} />;
    default:
      return <UnsupportedWidget content={content} />;
  }
}

export function WidgetRenderer({ content, onWidgetEvent }: WidgetRendererProps) {
  return (
    <WidgetErrorBoundary fallback={<UnsupportedWidget content={content} />}>
      <WidgetRendererInner content={content} onWidgetEvent={onWidgetEvent} />
    </WidgetErrorBoundary>
  );
}
