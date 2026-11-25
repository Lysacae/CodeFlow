import type { ReactNode } from "react";

type Props = {
  value: number;
  size?: number;
  stroke?: number;
  ticks?: boolean;
  label?: string;
  center?: ReactNode;
};

export function OrbitRing({
  value,
  size = 150,
  stroke = 8,
  ticks = false,
  label,
  center,
}: Props) {
  const cx = size / 2;
  const radius = size / 2 - stroke - (ticks ? 8 : 2);
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ - (clamped / 100) * circ;
  const end = (clamped / 100) * Math.PI * 2;
  const dotR = Math.max(2.5, stroke * 0.62);
  const dx = cx + radius * Math.cos(end);
  const dy = cx + radius * Math.sin(end);
  const gid = `orbit-${size}-${Math.round(clamped)}`;
  const marks = ticks
    ? Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2;
        const outer = size / 2 - 1;
        const inner = i % 10 === 0 ? outer - 9 : outer - 4.5;
        return {
          x1: cx + Math.cos(a) * outer,
          y1: cx + Math.sin(a) * outer,
          x2: cx + Math.cos(a) * inner,
          y2: cx + Math.sin(a) * inner,
        };
      })
    : [];

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--indigo)" />
            <stop offset="0.5" stopColor="var(--violet)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
        {marks.map((mark, index) => (
          <line key={index} className="tick" strokeWidth="1" {...mark} />
        ))}
        <circle className="track" cx={cx} cy={cx} r={radius} strokeWidth={stroke} />
        <circle
          className="arc"
          cx={cx}
          cy={cx}
          r={radius}
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
        {clamped > 0 ? (
          <circle cx={dx} cy={dy} r={dotR} fill="#fff" style={{ filter: "drop-shadow(0 0 4px var(--cyan))" }} />
        ) : null}
      </svg>
      <div className="center">
        {center ?? (
          <div>
            <b>
              {Math.round(clamped)}
              <span style={{ fontSize: 15, color: "var(--text-3)" }}>%</span>
            </b>
            {label ? <small>{label}</small> : null}
          </div>
        )}
      </div>
    </div>
  );
}
