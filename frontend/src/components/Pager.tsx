import {useEffect, useState} from 'react';
import {cn} from '../lib/cn';

/** Ro'yxatni sahifalarga bo'lish. Ro'yxat yoki sahifa hajmi o'zgarsa, sahifa chegaradan chiqmaydi. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePaged<T>(items: T[], size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const [page, setPage] = useState(0);
  const current = Math.min(page, pages - 1);
  return {page: current, pages, setPage, items: items.slice(current * size, current * size + size)};
}

/** Ekran kengligiga qarab qiymat (masalan, telefonda kamroq kartochka). */
// eslint-disable-next-line react-refresh/only-export-components
export function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** 1 2 3 … 7 — ko'p sahifada o'rtasi qisqartiriladi. */
function pageList(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({length: pages}, (_, i) => i);
  const set = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  const sorted = [...set].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

/**
 * Sahifalash tugmalari: ‹ 1 2 3 › — matnsiz, shuning uchun 3 tilda ham, admin panelda ham bir xil.
 * Bitta sahifa bo'lsa ko'rinmaydi.
 */
export function Pager({page, pages, onChange, className}: {page: number; pages: number; onChange: (page: number) => void; className?: string}) {
  if (pages <= 1) return null;
  const btn =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-full border-2 px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cherry/30 disabled:pointer-events-none disabled:opacity-30';
  return (
    <nav className={cn('flex flex-wrap items-center justify-center gap-2', className)} aria-label="pagination">
      <button type="button" className={cn(btn, 'border-navy text-navy hover:bg-navy hover:text-cream')} disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="‹">
        ‹
      </button>
      {pageList(page, pages).map((p, i) =>
        p === null ? (
          <span key={`gap${i}`} className="px-1 opacity-50">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page ? 'border-cherry bg-cherry text-white' : 'border-navy/20 text-navy hover:border-navy')}
          >
            {p + 1}
          </button>
        ),
      )}
      <button type="button" className={cn(btn, 'border-navy text-navy hover:bg-navy hover:text-cream')} disabled={page === pages - 1} onClick={() => onChange(page + 1)} aria-label="›">
        ›
      </button>
    </nav>
  );
}
