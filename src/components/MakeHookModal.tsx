import type { PointerEvent } from "react";

interface MakeHookModalProps {
  onClose: () => void;
}

export default function MakeHookModal({ onClose }: MakeHookModalProps) {
  const stopPropagation = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={stopPropagation}>
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
