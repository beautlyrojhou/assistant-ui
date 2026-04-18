import { createContext, useContext } from "react";
import type {
  ScrollDerivedState,
  ScrollState,
  ScrollStateActions,
} from "./useScrollState";

export type ScrollContextValue = {
  state: ScrollState;
  derived: ScrollDerivedState;
  actions: ScrollStateActions;
};

export const ScrollContext = createContext<ScrollContextValue | null>(null);

export const assertScrollContext = (value: ScrollContextValue | null) => {
  if (!value) {
    throw new Error("useScrollable must be used within ScrollPrimitive.Root.");
  }

  return value;
};

export const useScrollContext = () => {
  return assertScrollContext(useContext(ScrollContext));
};
