const RESTART_BAR = { x: 2, y: 6.5, w: 2, h: 11, rx: 0.4 };
const RESTART_BAR_RIGHT = RESTART_BAR.x + RESTART_BAR.w;
const RESTART_DOUBLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 9 6.5 L 9 17.5 Z M 9 12 L 14 6.5 L 14 17.5 Z`;
const RESTART_SINGLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 11 6.5 L 11 17.5 Z`;
const RESTART_ICON_CENTER_X_COMPOSITION = 4;
const RESTART_ICON_CENTER_X_VIEW = 5.5;

function RestartIconBase({
  centerX,
  chevronPath,
}: {
  centerX: number;
  chevronPath: string;
}) {
  const { x, y, w, h, rx } = RESTART_BAR;
  return (
    <svg
      className="btn-restart-svg"
      viewBox="0 0 24 24"
      width={15}
      height={15}
      aria-hidden
    >
      <g transform={`translate(${centerX}, 0)`}>
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" />
        <path fill="currentColor" d={chevronPath} />
      </g>
    </svg>
  );
}

export function IconRestartComposition() {
  return (
    <RestartIconBase
      centerX={RESTART_ICON_CENTER_X_COMPOSITION}
      chevronPath={RESTART_DOUBLE_CHEVRON_LEFT}
    />
  );
}

export function IconRestartView() {
  return (
    <RestartIconBase
      centerX={RESTART_ICON_CENTER_X_VIEW}
      chevronPath={RESTART_SINGLE_CHEVRON_LEFT}
    />
  );
}
