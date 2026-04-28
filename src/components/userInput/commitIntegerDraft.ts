import { clamp } from "../../utils";

export interface CommitIntegerDraftOptions {
  draft: string;
  fallback: number;
  min: number;
  max: number;
}

/**
 * Commits a numeric draft from a text input.
 *
 * - Empty or non-numeric drafts revert to fallback.
 * - Non-integers are rounded down immediately.
 * - Out-of-range drafts are clamped to nearest in-range value.
 */
export function commitIntegerDraft({
  draft,
  fallback,
  min,
  max,
}: CommitIntegerDraftOptions): number {
  const trimmed = draft.trim();
  if (!trimmed) return fallback;

  const flooredDraft = Math.floor(Number(trimmed));
  if (!Number.isFinite(flooredDraft)) return fallback;

  return clamp(flooredDraft, min, max);
}
