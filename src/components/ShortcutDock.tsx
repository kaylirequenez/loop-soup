import { GLOBAL_KEY_DOCK } from "./userInput/globalKeyHandler";

export default function ShortcutDock() {
  return (
    <div className="shortcut-dock" aria-label="Global keyboard shortcuts">
      {GLOBAL_KEY_DOCK.map((group) => (
        <div className="shortcut-group" key={group.label}>
          <div className="shortcut-group-label">{group.label}</div>
          <div className="shortcut-items">
            {group.items.map(([keyLabel, action]) => (
              <div className="shortcut-item" key={`${group.label}-${keyLabel}`}>
                <kbd>{keyLabel}</kbd>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
