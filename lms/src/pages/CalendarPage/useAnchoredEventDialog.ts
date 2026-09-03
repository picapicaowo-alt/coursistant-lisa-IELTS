import {useLayoutEffect, useRef} from 'react';

/** Position the contextual desktop window from the clicked control, measured after layout. */
export function useAnchoredEventDialog(anchor?: HTMLElement) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    const place = () => {
      const style = getComputedStyle(element);
      if (!anchor?.isConnected || style.getPropertyValue('--event-anchor-enabled').trim() !== '1') {
        delete element.dataset.anchored;
        return;
      }
      const gap = Number.parseFloat(style.paddingLeft) || 0;
      const trigger = anchor.getBoundingClientRect();
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const maxLeft = Math.max(gap, window.innerWidth - width - gap);
      const maxTop = Math.max(gap, window.innerHeight - height - gap);
      const rightFits = trigger.right + gap + width <= window.innerWidth;
      const leftFits = trigger.left - width - gap >= gap;
      const left = rightFits ? trigger.right + gap : leftFits ? trigger.left - width - gap : trigger.left;
      const top = rightFits || leftFits ? trigger.top : trigger.bottom + gap + height <= window.innerHeight ? trigger.bottom + gap : trigger.top - height - gap;
      element.dataset.anchored = 'true';
      element.style.setProperty('--event-left', `${Math.min(maxLeft, Math.max(gap, left))}px`);
      element.style.setProperty('--event-top', `${Math.min(maxTop, Math.max(gap, top))}px`);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);
  return dialog;
}
