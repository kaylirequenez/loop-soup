export function transportDebug(event: string, payload?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (payload) {
    console.debug(`[transport] ${event}`, payload);
    return;
  }
  console.debug(`[transport] ${event}`);
}
