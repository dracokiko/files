interface PhilosopherWatermarkProps {
  src: string;
  name: string;
  className?: string;
}

/**
 * Decorative philosopher watermark dropped into a section's own empty margin.
 * Positioned `absolute` against that section (which must be `relative`), so it
 * scrolls away with the page instead of sticking to the viewport.
 */
export default function PhilosopherWatermark({ src, name, className = '' }: PhilosopherWatermarkProps) {
  return (
    <figure
      className={`hidden xl:flex absolute flex-col items-center gap-3 z-0 pointer-events-none select-none ${className}`}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="w-40 2xl:w-48 opacity-[0.18] grayscale contrast-125 brightness-75"
        draggable={false}
      />
      <figcaption className="text-xs 2xl:text-sm tracking-[0.2em] text-gray-400 opacity-60 font-serif">
        {name}
      </figcaption>
    </figure>
  );
}
