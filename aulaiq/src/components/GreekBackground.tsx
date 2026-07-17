const GREEK_GLYPHS = [
  'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ',
  'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω',
  'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ',
  'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω',
];

interface Glyph {
  char: string;
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
}

function generateGlyphs(count: number): Glyph[] {
  const glyphs: Glyph[] = [];
  for (let i = 0; i < count; i++) {
    glyphs.push({
      char: GREEK_GLYPHS[Math.floor(Math.random() * GREEK_GLYPHS.length)],
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: 20 + Math.random() * 44,
      rotate: Math.random() * 50 - 25,
      opacity: 0.035 + Math.random() * 0.045,
    });
  }
  return glyphs;
}

// Generated once at module load so the layout stays stable across re-renders.
const GLYPHS = generateGlyphs(42);

export default function GreekBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {GLYPHS.map((g, i) => (
        <span
          key={i}
          className="absolute font-serif text-gray-500"
          style={{
            top: g.top,
            left: g.left,
            fontSize: `${g.size}px`,
            opacity: g.opacity,
            transform: `rotate(${g.rotate}deg)`,
          }}
        >
          {g.char}
        </span>
      ))}
    </div>
  );
}
