import {motion, useReducedMotion, useScroll, useTransform} from 'framer-motion';
import {useRef, type ReactNode} from 'react';
import {cn} from '../../lib/cn';

/**
 * Sichqoncha ostida 3D egiluvchi karta. Faqat aniq ko'rsatkichli qurilmalarda (sichqoncha) ishlaydi —
 * telefonda hech qanday hisob-kitob qilinmaydi. Transform requestAnimationFrame orqali, to'g'ridan-to'g'ri DOM'ga yoziladi
 * (React re-render yo'q).
 */
export function TiltCard({children, className, max = 8}: {children: ReactNode; className?: string; max?: number}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const reduce = useReducedMotion();

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
      el.style.setProperty('--glare-x', `${(x + 0.5) * 100}%`);
      el.style.setProperty('--glare-y', `${(y + 0.5) * 100}%`);
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    if (ref.current) ref.current.style.transform = '';
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn('tilt-card relative h-full transition-transform duration-300 ease-out', className)}>
      {children}
      <span aria-hidden className="tilt-glare pointer-events-none absolute inset-0 rounded-2xl" />
    </div>
  );
}

/** Harflari 3D aylanib chiqadigan sarlavha */
export function SplitLetters({text, className, delay = 0}: {text: string; className?: string; delay?: number}) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span className={cn('inline-block [perspective:600px]', className)} aria-label={text}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block origin-bottom"
          initial={{opacity: 0, rotateX: -90, y: 30}}
          animate={{opacity: 1, rotateX: 0, y: 0}}
          transition={{delay: delay + i * 0.06, type: 'spring', stiffness: 160, damping: 14}}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

/** Cheksiz aylanuvchi lenta (CSS animatsiya, kontent ikki marta — chok ko'rinmaydi) */
export function Marquee({items, className, reverse}: {items: string[]; className?: string; reverse?: boolean}) {
  const row = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-8 whitespace-nowrap">
          <span>{t}</span>
          <span aria-hidden className="text-cherry">★</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={cn('overflow-hidden', className)} aria-hidden>
      <div className={cn('marquee flex w-max', reverse && 'marquee-reverse')}>
        {row}
        {row}
      </div>
    </div>
  );
}

/** Aylantirganda parallaks bilan suzuvchi bezak (qaychi, taroq, ustara) */
export function FloatingDecor({className, speed = 80, rotate = 25, children}: {className?: string; speed?: number; rotate?: number; children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const {scrollYProgress} = useScroll({target: ref, offset: ['start end', 'end start']});
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  const r = useTransform(scrollYProgress, [0, 1], [-rotate, rotate]);
  return (
    <motion.div ref={ref} aria-hidden style={reduce ? undefined : {y, rotate: r}} className={cn('pointer-events-none absolute select-none', className)}>
      {children}
    </motion.div>
  );
}

export const ScissorsIcon = ({className}: {className?: string}) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <circle cx="16" cy="46" r="8" />
    <circle cx="16" cy="18" r="8" />
    <path d="M22 41 56 14M22 23l34 27" />
  </svg>
);

export const CombIcon = ({className}: {className?: string}) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <rect x="6" y="14" width="52" height="12" rx="4" />
    {Array.from({length: 9}).map((_, i) => (
      <path key={i} d={`M${11 + i * 5.3} 26v22`} />
    ))}
  </svg>
);

export const RazorIcon = ({className}: {className?: string}) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 40 40 8l8 8-32 32z" />
    <path d="M40 24l16 16-6 6-16-16" />
  </svg>
);

/** Muvaffaqiyat konfettisi — 28 ta zarra, faqat transform/opacity; 2 soniyada tugaydi */
export function Confetti() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const colors = ['#d62e2e', '#1f3d7a', '#c9a227', '#ffffff'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({length: 28}).map((_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const dist = 120 + (i % 5) * 30;
        return (
          <motion.span
            key={i}
            className="absolute top-24 left-1/2 block h-2.5 w-1.5 rounded-sm"
            style={{background: colors[i % colors.length], boxShadow: '0 0 0 1px rgba(31,61,71,0.15)'}}
            initial={{x: 0, y: 0, opacity: 1, rotate: 0}}
            animate={{x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 160, opacity: 0, rotate: 360 + i * 25}}
            transition={{duration: 1.6 + (i % 4) * 0.15, ease: [0.15, 0.6, 0.35, 1], delay: 0.15}}
          />
        );
      })}
    </div>
  );
}
