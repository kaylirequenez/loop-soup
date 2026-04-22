export default function DevToolbar({
  onTogglePlay,
  onToggleAdd,
  onTogglePicker,
  onSetView,
  sampleSoundOn,
  onSetSampleSoundOn,
  onClearSavedState,
}) {
  return (
    <div className="dev-toolbar">
      <button onClick={onTogglePlay}>play/pause</button>
      <button onClick={onToggleAdd}>toggle add</button>
      <button onClick={onTogglePicker}>sound picker</button>
      <button onClick={() => onSetView("layers")}>layers</button>
      <button onClick={() => onSetView("midi")}>midi roll</button>
      <button onClick={() => onSetSampleSoundOn(!sampleSoundOn)}>
        sample toggle
      </button>
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
