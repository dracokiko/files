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

// Row r reads 1..11 left to right (col + 2*row, wrapped), so every row is a
// rotation of "1,2,3,...,11". Shifting the sequence by 2 per row — combined
// with the half-step brick offset below — guarantees a given icon never has
// the same icon directly above it, nor diagonally above-left/above-right.
function iconNumberAt(row: number, col: number): number {
  const shifted = ((col + 2 * row) % PICTOGRAM_COUNT + PICTOGRAM_COUNT) % PICTOGRAM_COUNT;
  return shifted + 1;
}

// Small deterministic tilt/opacity variation so the pattern isn't perfectly
// static-looking, without relying on Math.random (keeps the layout a pure
// function of row/col, matching resize-stable, reload-stable output).
function pseudoRandom(row: number, col: number): number {
  const n = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function buildGrid(width: number, height: number): Placement[] {
  if (!width || !height) return [];
  const cols = Math.ceil(width / STEP) + 1;
  const rows = Math.ceil(height / STEP);
  const placements: Placement[] = [];
  for (let row = 0; row < rows; row++) {
    // Every other row is offset by half a step, so its icons sit centered
    // between the icons of the row above (brick/masonry layout).
    const offsetX = row % 2 === 1 ? STEP / 2 : 0;
    for (let col = 0; col < cols; col++) {
      const left = col * STEP + offsetX + STEP / 2;
      if (left > width + STEP / 2) continue;
      const num = iconNumberAt(row, col);
      const rand = pseudoRandom(row, col);
      placements.push({
        src: PICTOGRAMS[num - 1],
        top: row * STEP + STEP / 2,
        left,
        rotate: rand * 40 - 20,
        opacity: 0.035 + pseudoRandom(col, row) * 0.045,
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
