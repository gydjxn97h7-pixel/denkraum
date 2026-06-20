import { useEffect, type RefObject } from "react";

// Fire `handler` when a pointer/touch press lands outside `ref`. Adapted from
// the Motion Primitives useClickOutside hook. Pass a stable `handler`
// (useCallback) so the listener isn't re-subscribed every render.
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}
