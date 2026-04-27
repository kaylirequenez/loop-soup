function clearPersistedSession() {
  try {
    [
      "loop-soup",
      "loop-soup-layers",
      "loop-soup-transport",
      "loop-soup-composition",
      "loop-soup-loop-definitions",
    ].forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore quota / private mode */
  }
  window.location.reload();
}

export default function DevToolbar() {
  return (
    <div className="dev-toolbar">
      <button
        type="button"
        onClick={clearPersistedSession}
        title="Clear saved session in localStorage and reload"
      >
        clear saved state
      </button>
    </div>
  );
}
