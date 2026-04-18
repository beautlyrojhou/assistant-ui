import type { ScrollKey } from "./useScrollState";

export const mapsEqual = (
  left: Map<ScrollKey, number>,
  right: Map<ScrollKey, number>,
) => {
  if (left === right) return true;
  if (left.size !== right.size) return false;

  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }

  return true;
};

export const arraysEqual = (left: ScrollKey[], right: ScrollKey[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }

  return true;
};
