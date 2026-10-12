import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {cn} from '../lib/cn';


export function BarberPole({className}: {className?: string}) {
  return <div aria-hidden className={cn('barber-pole', className)} />;
}

/** Art Deco bezagi: ◆ ── matn ── ◆ */
export function Ornament({children, className}: {children?: ReactNode; className?: string}) {
  return (
    <div className={cn('flex items-center justify-center gap-3 text-xs font-semibold tracking-[0.35em] uppercase', className)}>
      <span aria-hidden>◆</span>
      {children ? <span>{children}</span> : <span aria-hidden className="h-px w-16 bg-current" />}
      <span aria-hidden>◆</span>
    </div>
  );
}

export function SectionTitle({title, sub, id}: {title: string; sub?: string; id?: string}) {
  return (
    <div id={id} className="scroll-mt-28 text-center mb-10">
      <h2 className="font-deco text-cherry text-5xl md:text-6xl leading-none">{title}</h2>
      {sub ? <Ornament className="mt-4 text-navy">{sub}</Ornament> : null}
    </div>
  );
}

type Variant = 'primary' | 'outline' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-cherry text-white hover:bg-cherry-dark shadow-[0_4px_0_0_var(--color-navy)] active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--color-navy)]',
  outline: 'border-2 border-navy text-navy hover:bg-navy hover:text-cream',
  ghost: 'text-navy hover:bg-cream-dark',
};
const base =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold tracking-[0.15em] uppercase transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cherry/30';

export function Button({variant = 'primary', className, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: Variant}) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({to, variant = 'primary', className, children}: {to: string; variant?: Variant; className?: string; children: ReactNode}) {
  return (
    <Link to={to} className={cn(base, variants[variant], className)}>
      {children}
    </Link>
  );
}

export function Stars({value, className}: {value: number; className?: string}) {
  return (
    <span className={cn('inline-flex gap-0.5 text-cherry', className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden className={i <= Math.round(value) ? '' : 'opacity-25'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Card({children, className, active}: {children: ReactNode; className?: string; active?: boolean}) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 bg-white/60 transition',
        active ? 'border-cherry bg-cherry/5 shadow-[0_0_0_3px_rgba(214,46,46,0.15)]' : 'border-navy',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Rasm bo'lmaganda: monogramma doira */
export function Monogram({name, className}: {name: string; className?: string}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full border-2 border-cherry bg-cream font-deco text-navy',
        className,
      )}
    >
      {name.slice(0, 1)}
    </div>
  );
}

export function Spinner({className}: {className?: string}) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
}
