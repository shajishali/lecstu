import { useEffect, useRef } from 'react';

/**
 * Keeps the active step item visible inside the scrollable step list when
 * stepIndex changes.
 *
 * Uses getBoundingClientRect() so the position is always relative to the
 * list's VISIBLE area - not to some distant offsetParent which would cause
 * the list to jump wildly on each Next/Previous click.
 */
export function useActiveStepScroll(stepIndex: number) {
  const listRef = useRef<HTMLOListElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const item = activeRef.current;
    if (!list || !item) return;

    // Position of the item relative to the list's current scroll position.
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    // Item's top/bottom relative to the list's scroll origin.
    const relTop    = itemRect.top  - listRect.top  + list.scrollTop;
    const relBottom = itemRect.bottom - listRect.top + list.scrollTop;

    const pad = 6; // px breathing room above/below

    if (relTop - pad < list.scrollTop) {
      // Item is above the visible area - scroll up to it.
      list.scrollTo({ top: Math.max(0, relTop - pad), behavior: 'smooth' });
    } else if (relBottom + pad > list.scrollTop + list.clientHeight) {
      // Item is below the visible area - scroll down just enough to show it.
      list.scrollTo({
        top: relBottom + pad - list.clientHeight,
        behavior: 'smooth',
      });
    }
    // Item already visible → do nothing (no jump).
  }, [stepIndex]);

  return { listRef, activeRef };
}
