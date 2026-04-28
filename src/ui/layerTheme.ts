/** UI presentation constants for layers. */

import type { LayerId } from "../types/layer";

/** Maps each layer to its CSS custom property for accent color. */
export const LAYER_COLORS: Record<LayerId, string> = {
  A: "var(--layer-a)",
  B: "var(--layer-b)",
  C: "var(--layer-c)",
  D: "var(--layer-d)",
  E: "var(--layer-e)",
};
