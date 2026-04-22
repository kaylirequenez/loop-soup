import type { RefObject } from "react";

interface PointerDragConfig<T extends HTMLElement> {
  dragLockClassName?: string;
  onStart?: (el: T, event: React.PointerEvent<T>) => void;
  onMove: (el: T, event: PointerEvent) => void;
  onEnd?: (el: T) => void;
  captureTargetRef?: RefObject<HTMLElement | null>;
}

export function usePointerDrag<T extends HTMLElement>({
  dragLockClassName = "drag-selection-lock",
  onStart,
  onMove,
  onEnd,
  captureTargetRef,
}: PointerDragConfig<T>) {
  return (event: React.PointerEvent<T>) => {
    event.preventDefault();
    const element = (captureTargetRef?.current as T | null) ?? event.currentTarget;
    const pointerId = event.pointerId;
    element.setPointerCapture(pointerId);
    document.body.classList.add(dragLockClassName);
    onStart?.(element, event);

    const moveHandler = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      onMove(element, moveEvent);
    };
    const endHandler = () => {
      element.removeEventListener("pointermove", moveHandler);
      element.removeEventListener("pointerup", endHandler);
      element.removeEventListener("pointercancel", endHandler);
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      document.body.classList.remove(dragLockClassName);
      onEnd?.(element);
    };

    element.addEventListener("pointermove", moveHandler);
    element.addEventListener("pointerup", endHandler);
    element.addEventListener("pointercancel", endHandler);
  };
}
