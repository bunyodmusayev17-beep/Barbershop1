import {lazy, Suspense, useEffect, useState} from 'react';
import {cn} from '../../lib/cn';

const Pole3D = lazy(() => import('./Pole3D'));

/** 3D'ni qo'llash mumkinmi: WebGL bor, "harakatni kamaytirish" o'chiq, qurilma juda kuchsiz emas. */
function canUse3D() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const nav = navigator as Navigator & {deviceMemory?: number; connection?: {saveData?: boolean; effectiveType?: string}};
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return false;
  // Trafik tejash yoki sekin internet — 3D kutubxonani (≈230 KB) yuklamaymiz
  if (nav.connection?.saveData) return false;
  if (nav.connection?.effectiveType && /(^|-)2g|3g/.test(nav.connection.effectiveType)) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Yengil CSS barber-pole — 3D yuklanguncha va kuchsiz qurilmalarda */
export function CssPole({className}: {className?: string}) {
  return (
    <div className={cn('flex flex-col items-center justify-center', className)} aria-hidden>
      <div className="h-7 w-24 rounded-t-full border-4 border-navy bg-cream" />
      <div className="h-3.5 w-32 rounded-md bg-navy" />
      <div className="relative h-[62%] w-20 overflow-hidden border-x-4 border-navy bg-white">
        <div className="pole-spin absolute inset-0" />
        <div className="absolute inset-y-0 left-2 w-3 bg-white/40 blur-sm" />
      </div>
      <div className="h-3.5 w-32 rounded-md bg-navy" />
      <div className="h-7 w-24 rounded-b-full border-4 border-navy bg-cream" />
    </div>
  );
}

/**
 * Sahifa yuklanib bo'lgach (brauzer bo'sh paytida) 3D kutubxonani yuklaydi — birinchi ochilish tezligiga ta'sir qilmaydi.
 * Shu vaqtgacha va 3D ishlamaydigan joyda CSS pole ko'rinadi (o'lchami bir xil — sahifa "sakramaydi").
 */
export function HeroPole({className}: {className?: string}) {
  const [load3D, setLoad3D] = useState(false);

  useEffect(() => {
    if (!canUse3D()) return;
    const w = window as Window & {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number; cancelIdleCallback?: (id: number) => void};
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setLoad3D(true), {timeout: 2500});
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setLoad3D(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={cn('relative', className)}>
      {load3D ? (
        <Suspense fallback={<CssPole className="absolute inset-0" />}>
          <Pole3D className="absolute inset-0" />
        </Suspense>
      ) : (
        <CssPole className="absolute inset-0" />
      )}
    </div>
  );
}
