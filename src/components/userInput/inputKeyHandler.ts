export interface InputKeyHandlerOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  blurOnEnter?: boolean;
  blurOnEscape?: boolean;
}

/**
 * Returns an `onKeyDown` handler for text inputs:
 * - Enter optionally calls `onEnter`, then optionally blurs the input.
 * - Escape optionally calls `onEscape`, then optionally blurs the input.
 */
export function inputKeyHandler(
  options: InputKeyHandlerOptions = {},
): (e: React.KeyboardEvent<HTMLInputElement>) => void {
  const {
    onEnter,
    onEscape,
    blurOnEnter = true,
    blurOnEscape = true,
  } = options;

  return (e) => {
    if (e.key === "Enter") {
      onEnter?.();
      if (blurOnEnter) e.currentTarget.blur();
      return;
    }
    if (e.key === "Escape") {
      onEscape?.();
      if (blurOnEscape) e.currentTarget.blur();
    }
  };
}
