import {createContext, useCallback, useContext, useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes} from 'react';
import type {AppointmentStatus} from '../../api/admin';
import type {LocalizedText} from '../../api/types';
import {cn} from '../../lib/cn';

// eslint-disable-next-line react-refresh/only-export-components
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  Pending: 'Kutilmoqda',
  Confirmed: 'Tasdiqlangan',
  Completed: 'Bajarildi',
  Cancelled: 'Bekor qilindi',
  NoShow: 'Kelmadi',
};

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800 border-amber-300',
  Confirmed: 'bg-sky-100 text-sky-800 border-sky-300',
  Completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-300 line-through',
  NoShow: 'bg-rose-100 text-rose-800 border-rose-300',
};

export function StatusBadge({status}: {status: AppointmentStatus}) {
  return <span className={cn('inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function PageHeader({title, sub, actions}: {title: string; sub?: string; actions?: ReactNode}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-deco text-4xl text-navy md:text-5xl">{title}</h1>
        {sub ? <p className="mt-1 text-sm opacity-70">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({children, className, title}: {children: ReactNode; className?: string; title?: string}) {
  return (
    <section className={cn('rounded-2xl border-2 border-navy/15 bg-white p-5 shadow-sm', className)}>
      {title ? <h2 className="mb-4 text-sm font-bold tracking-[0.2em] uppercase text-navy/70">{title}</h2> : null}
      {children}
    </section>
  );
}

export const inputCls =
  'w-full rounded-xl border-2 border-navy/25 bg-white px-3 py-2 text-sm outline-none transition focus:border-cherry focus:ring-4 focus:ring-cherry/10 disabled:bg-zinc-50';

export function Field({label, hint, children, className}: {label: string; hint?: string; children: ReactNode; className?: string}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-bold tracking-wider uppercase text-navy/70">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs opacity-60">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, 'min-h-20', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, 'pr-8', props.className)} />;
}

export function Toggle({checked, onChange, label}: {checked: boolean; onChange: (v: boolean) => void; label: string}) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3 text-sm font-semibold">
      <span className={cn('relative h-6 w-11 rounded-full transition', checked ? 'bg-emerald-500' : 'bg-zinc-300')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

export function Btn({variant = 'primary', className, ...props}: React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary' | 'outline' | 'danger' | 'ghost'}) {
  const v = {
    primary: 'bg-cherry text-white hover:bg-cherry-dark',
    outline: 'border-2 border-navy text-navy hover:bg-navy hover:text-cream',
    danger: 'border-2 border-rose-300 text-rose-700 hover:bg-rose-50',
    ghost: 'text-navy hover:bg-cream-dark',
  }[variant];
  return (
    <button
      {...props}
      className={cn('inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold tracking-widest uppercase transition disabled:pointer-events-none disabled:opacity-50', v, className)}
    />
  );
}

const LANGS: {key: keyof LocalizedText; label: string}[] = [
  {key: 'uz', label: "O'zbekcha"},
  {key: 'ru', label: 'Ruscha'},
  {key: 'en', label: 'Inglizcha'},
];

/** 3 tilli matnni tahrirlash: til tablari, o'zbekchasi majburiy. */
export function LangFields({label, value, onChange, multiline, required}: {label: string; value: LocalizedText; onChange: (v: LocalizedText) => void; multiline?: boolean; required?: boolean}) {
  const [tab, setTab] = useState<keyof LocalizedText>('uz');
  const Comp = multiline ? Textarea : Input;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wider uppercase text-navy/70">{label}</span>
        <div className="flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setTab(l.key)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase',
                tab === l.key ? 'bg-navy text-cream' : 'text-navy/60 hover:bg-cream-dark',
                !value[l.key] && tab !== l.key && 'text-cherry',
              )}
              title={l.label}
            >
              {l.key}
              {!value[l.key] ? ' •' : ''}
            </button>
          ))}
        </div>
      </div>
      <Comp
        value={value[tab]}
        required={required && tab === 'uz'}
        placeholder={LANGS.find((l) => l.key === tab)?.label}
        onChange={(e: {target: {value: string}}) => onChange({...value, [tab]: e.target.value})}
      />
    </div>
  );
}

export function Modal({open, title, onClose, children, wide}: {open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label={title} className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-cream shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="barber-pole !h-2 rounded-t-3xl" />
        <div className="flex items-center justify-between gap-4 px-6 pt-5">
          <h2 className="font-deco text-3xl text-navy">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy/30 hover:border-navy">
            ✕
          </button>
        </div>
        <div className="px-6 pt-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Empty({children}: {children: ReactNode}) {
  return <div className="rounded-2xl border-2 border-dashed border-navy/20 p-10 text-center text-sm opacity-70">{children}</div>;
}

// --- Toast bildirishnomalar ---
type Toast = {id: number; text: string; kind: 'ok' | 'error'};
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});

export function ToastProvider({children}: {children: ReactNode}) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, {id, text, kind}]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('rounded-xl px-4 py-3 text-sm font-semibold shadow-lg', t.kind === 'ok' ? 'bg-navy text-cream' : 'bg-cherry text-white')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx);

/** Server xatosini o'zbekcha matnga aylantirish */
// eslint-disable-next-line react-refresh/only-export-components
export function errorText(e: unknown): string {
  const err = e as {status?: number; code?: string; message?: string};
  if (err.code === 'slot_taken' || err.code === 'slot_unavailable') return 'Bu vaqtda ustada boshqa zapis bor';
  if (err.code === 'phone_invalid') return "Telefon raqam noto'g'ri";
  if (err.status === 403) return "Bu amal uchun ruxsat yo'q";
  if (err.status === 409) return err.message || 'Ziddiyat: maʼlumot band';
  return err.message || 'Xatolik yuz berdi';
}

// eslint-disable-next-line react-refresh/only-export-components
export function money(n: number) {
  return `${n.toLocaleString('ru-RU').replace(/,/g, ' ')} so'm`;
}
