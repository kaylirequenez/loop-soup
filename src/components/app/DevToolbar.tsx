interface DevToolbarProps {
  onClearSavedState: () => void;
}

export default function DevToolbar({ onClearSavedState }: DevToolbarProps) {
  return (
    <div className="dev-toolbar">
      <button
        type="button"
        onClick={onClearSavedState}
        title="Clear saved session in localStorage and reload"
      >
        clear saved state
      </button>
    </div>
  );
}
