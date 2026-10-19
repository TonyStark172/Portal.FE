import { useSyncExternalStore } from "react";

/**
 * The selected card's id, kept outside React state so that choosing a card re-renders only the card that lost the
 * selection and the one that gained it. Were the id passed down as a prop or through context, every one of the ~200
 * branches of the chart would render again on each click.
 */
export type SelectionStore = {
  get: () => number | null;
  set: (id: number | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createSelectionStore(initial: number | null): SelectionStore {
  let selected = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => selected,
    set: (id) => {
      if (id === selected) return;
      selected = id;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** Whether card `id` is the selected one; the component re-renders only when this answer changes. */
export function useIsSelected(store: SelectionStore, id: number): boolean {
  const read = () => store.get() === id;
  return useSyncExternalStore(store.subscribe, read, read);
}
