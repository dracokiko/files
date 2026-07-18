import { useEffect, useMemo, useRef, useState } from 'react';

const PICTOGRAM_COUNT = 11;
const PICTOGRAMS = Array.from(
  { length: PICTOGRAM_COUNT },
  (_, i) => `/images/pictogramas/${i + 1}.png`,
);

// Center-to-center spacing between icons. Kept well above ICON_SIZE so
// neighboring icons never touch, even at max rotation.
const STEP = 130;
const ICON_SIZE = 34;

interface Placement {
  src: string;
  top: number;
  left: number;
  rotate: number;
  opacity: number;
}

function buildGrid(width: number, height: number): Placement[] {
  if (!width || !height) return [];
  const cols = Math.ceil(width / STEP);
  const rows = Math.ceil(height / STEP);
  const placements: Placement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      placements.push({
        src: PICTOGRAMS[Math.floor(Math.random() * PICTOGRAMS.length)],
        top: row * STEP + STEP / 2,
        left: col * STEP + STEP / 2,
        rotate: Math.random() * 40 - 20,
        opacity: 0.035 + Math.random() * 0.045,
      });
    }
  }
  return placements;
}

export default function PictogramBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        Math.abs(prev.width - width) > STEP / 2 || Math.abs(prev.height - height) > STEP / 2
          ? { width, height }
          : prev,
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Only rebuilt when the grid's dimensions actually change (not on every
  // sub-pixel resize), so the pattern stays stable across re-renders.
  const placements = useMemo(() => buildGrid(size.width, size.height), [size.width, size.height]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {placements.map((p, i) => (
        <img
          key={i}
          src={p.src}
          alt=""
          className="absolute"
          style={{
            top: `${p.top}px`,
            left: `${p.left}px`,
            width: `${ICON_SIZE}px`,
            height: `${ICON_SIZE}px`,
            opacity: p.opacity,
            transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
