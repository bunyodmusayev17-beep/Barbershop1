/**
 * Butun ilova uchun bosish effekti (ripple): bosilgan nuqtadan to'lqin tarqaladi.
 * Bitta global listener — har bir tugmani alohida o'zgartirish shart emas.
 * Faqat transform/opacity animatsiyasi (GPU), element tugagach DOM'dan o'chiriladi.
 */
const TARGET = 'button, a[href], [role="button"], label:has(> input[type="checkbox"])';

export function installPressFx() {
  if (typeof window === 'undefined') return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (reduce.matches || e.button !== 0) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(TARGET);
      if (!el || el.matches(':disabled, [aria-disabled="true"], [data-no-ripple]')) return;
      // Matn havolalari (paragraf ichidagi) uchun ripple kerak emas — faqat blok/tugma ko'rinishidagilar
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return;

      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const ink = document.createElement('span');
      ink.className = 'ripple-ink';
      ink.style.width = ink.style.height = `${size}px`;
      ink.style.left = `${e.clientX - rect.left - size / 2}px`;
      ink.style.top = `${e.clientY - rect.top - size / 2}px`;

      const style = getComputedStyle(el);
      if (style.position === 'static') el.style.position = 'relative';
      if (style.overflow === 'visible') el.style.overflow = 'hidden';
      el.appendChild(ink);
      ink.addEventListener('animationend', () => ink.remove(), {once: true});
    },
    {passive: true},
  );
}
