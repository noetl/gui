import React from "react";
import { Carousel } from "antd";
import type { AppCarouselArgs, OnWidgetEvent, WidgetProps } from "./types";
import { WidgetRenderer } from "./WidgetRenderer";

// chatui's AppCarousel slides between nested widgets. We use antd's
// Carousel with arrow navigation; the chatui-specific custom arrows
// are a UX polish we can add later.
export function AppCarousel({ args, onWidgetEvent }: WidgetProps<AppCarouselArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { carouselWidth, carouselHeight, widgets = [] } = args || ({} as AppCarouselArgs);
  return (
    <div
      className="noetl-widget noetl-widget-carousel"
      style={{
        width: carouselWidth ? `${carouselWidth}px` : "100%",
        height: carouselHeight ? `${carouselHeight}px` : undefined,
      }}
    >
      <Carousel arrows dots>
        {widgets.map((widget, index) => (
          <div key={index} style={{ padding: 8 }}>
            <WidgetRenderer content={widget} onWidgetEvent={onWidgetEvent} />
          </div>
        ))}
      </Carousel>
    </div>
  );
}
