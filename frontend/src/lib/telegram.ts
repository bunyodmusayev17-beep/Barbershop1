/**
 * Telegram Mini App: sayt Telegram ichida ochilganini aniqlash va Telegram imkoniyatlari.
 * Oddiy brauzerda hech narsa yuklanmaydi va hech narsa o'zgarmaydi.
 *
 * Telegram ishga tushirish ma'lumotini URL hash'ida beradi (#tgWebAppData=...). Uni sessiyada saqlaymiz —
 * sahifa yangilansa ham Mini App ekanligi saqlanib qoladi.
 */

type BackButton = {show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void};

type WebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  BackButton: BackButton;
  HapticFeedback?: {impactOccurred(style: 'light' | 'medium'): void};
};

declare global {
  interface Window {
    Telegram?: {WebApp?: WebApp};
  }
}

const KEY = 'nyb_tg_init';
const SCRIPT = 'https://telegram.org/js/telegram-web-app.js';

function readInitData(): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('tgWebAppData');
  try {
    if (fromHash) sessionStorage.setItem(KEY, fromHash);
    return fromHash ?? sessionStorage.getItem(KEY);
  } catch {
    return fromHash;
  }
}

/** Telegram imzolagan initData (serverda tekshiriladi). Telegram tashqarisida — null. */
export const tgInitData = readInitData();
export const inTelegram = !!tgInitData;

export const webApp = (): WebApp | undefined => window.Telegram?.WebApp;

/**
 * Telegram ichida: rasmiy skriptni yuklaydi (u ham hash'ni o'qiydi), so'ng hash'ni tozalaydi,
 * ilovani to'liq ekranga yoyadi va rangni saytga moslaydi. Uzog'i bilan 3 soniya kutadi.
 */
export async function initTelegram(): Promise<void> {
  if (!inTelegram) return;
  await new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.onload = s.onerror = () => resolve();
    document.head.appendChild(s);
    setTimeout(resolve, 3000);
  });
  if (window.location.hash.includes('tgWebAppData')) history.replaceState(null, '', window.location.pathname + window.location.search);

  const app = webApp();
  if (!app) return;
  app.ready();
  app.expand();
  app.setHeaderColor('#fbf6ec');
  app.setBackgroundColor('#fbf6ec');
}

export function haptic() {
  webApp()?.HapticFeedback?.impactOccurred('light');
}
