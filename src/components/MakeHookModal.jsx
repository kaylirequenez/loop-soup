/**
 * Spec contract:
 * - Modal entry for setup-phase hook creation.
 * - Two paths: microphone and SoftPot.
 * - Later: recording, Essentia analysis, detection override, confirm commit.
 */
export default function MakeHookModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>make hook</h2>
        <p>choose input method</p>
        <div className="modal-actions">
          <button className="btn">microphone</button>
          <button className="btn">softpot</button>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}
