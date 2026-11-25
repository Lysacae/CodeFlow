export function OrbitBackdrop() {
  return (
    <svg className="cf-orbit" viewBox="0 0 900 900" aria-hidden="true">
      <ellipse cx="450" cy="450" rx="430" ry="160" transform="rotate(-24 450 450)" />
      <ellipse cx="450" cy="450" rx="330" ry="120" transform="rotate(-24 450 450)" strokeDasharray="2 6" />
      <circle cx="450" cy="450" r="250" />
      <circle className="cf-orbit-dot" cx="84" cy="610" r="3" />
      <circle className="cf-orbit-dot" cx="700" cy="450" r="2" />
    </svg>
  );
}
