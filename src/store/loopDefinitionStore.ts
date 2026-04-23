import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LoopDefinition, LoopDefinitionId, LoopDefinitionsState } from "../types/loop";

export const LOOP_DEFINITION_STORE_KEY = "loop-soup-loop-definitions";

/**
 * Loop definition store
 *
 * Owns saved reusable loop musical content only (definitions catalog).
 * Does not own layer placement, repeat, or mappings.
 *
 * Not yet wired from all UI paths; layer persistence may also hydrate definitions during merge.
 */
interface LoopDefinitionStoreState {
  definitions: LoopDefinitionsState;
  upsertDefinition: (definition: LoopDefinition) => void;
  removeDefinition: (id: LoopDefinitionId) => void;
}

export const useLoopDefinitionStore = create<LoopDefinitionStoreState>()(
  persist(
    (set) => ({
      definitions: {},

      upsertDefinition: (definition) =>
        set((s) => ({
          definitions: { ...s.definitions, [definition.id]: definition },
        })),

      removeDefinition: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.definitions;
          return { definitions: rest };
        }),
    }),
    {
      name: LOOP_DEFINITION_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ definitions: state.definitions }),
    },
  ),
);
