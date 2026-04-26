import React, { createContext, useContext } from "react";

export interface ViewToolbarContextValue {
  actions: React.ReactNode;
  setActions: (actions: React.ReactNode) => void;
  clearActions: () => void;
}

export const ViewToolbarContext = createContext<ViewToolbarContextValue | null>(null);

export function useViewToolbar(): ViewToolbarContextValue {
  const context = useContext(ViewToolbarContext);
  if (!context) {
    throw new Error("useViewToolbar must be used inside ViewToolbarContext.Provider");
  }
  return context;
}
