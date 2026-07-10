interface PhilosopherProps {
  src: string;
  name: string;
  className?: string;
}

function Philosopher({ src, name, className = '' }: PhilosopherProps) {
  return (
    <figure className={`absolute flex flex-col items-center gap-3 ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="w-40 xl:w-48 opacity-[0.07] grayscale select-none"
        draggable={false}
      />
      <figcaption className="text-xs xl:text-sm tracking-[0.2em] text-gray-400 opacity-40 font-serif select-none">
        {name}
      </figcaption>
    </figure>
  );
}

/**
 * Decorative philosopher watermarks fixed in the empty side margins of the page.
 * Hidden below the `xl` breakpoint, where those margins disappear.
 */
export default function PhilosopherBackdrop() {
  return (
    <div className="hidden xl:block fixed inset-0 z-10 pointer-events-none overflow-hidden">
      <Philosopher
        src="/images/philosophers/socrates.png"
        name="ΣΩΚΡΑΤΗΣ"
        className="left-4 2xl:left-10 top-[14%]"
      />
      <Philosopher
        src="/images/philosophers/hypatia.png"
        name="ὙΠΑΤΙΑ"
        className="left-4 2xl:left-10 bottom-[8%]"
      />
      <Philosopher
        src="/images/philosophers/epicurus.png"
        name="ΕΠΙΚΟΥΡΟΣ"
        className="right-4 2xl:right-10 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}
