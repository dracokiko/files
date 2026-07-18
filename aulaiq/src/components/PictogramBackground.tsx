const PICTOGRAM_COUNT = 11;
const PICTOGRAMS = Array.from(
  { length: PICTOGRAM_COUNT },
  (_, i) => `/images/pictogramas/${i + 1}.png`,
);

interface Placement {
  src: string;
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
}

function generatePlacements(count: number): Placement[] {
  const placements: Placement[] = [];
  for (let i = 0; i < count; i++) {
    placements.push({
      src: PICTOGRAMS[Math.floor(Math.random() * PICTOGRAMS.length)],
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: 28 + Math.random() * 48,
      rotate: Math.random() * 50 - 25,
      opacity: 0.035 + Math.random() * 0.045,
    });
  }
  return placements;
}

// Generated once at module load so the layout stays stable across re-renders.
const PLACEMENTS = generatePlacements(36);

export default function PictogramBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {PLACEMENTS.map((p, i) => (
        <img
          key={i}
          src={p.src}
          alt=""
          className="absolute"
          style={{
            top: p.top,
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
