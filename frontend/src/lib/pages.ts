import {lazy, type ComponentType} from 'react';

type Loader<T> = () => Promise<{default: T}>;

/** lazy() + oldindan yuklash imkoniyati: preload() chaqirilsa, bosilganda sahifa kutishsiz ochiladi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithPreload<T extends ComponentType<any>>(load: Loader<T>) {
  let promise: Promise<{default: T}> | null = null;
  const get = () => (promise ??= load());
  return Object.assign(lazy(get), {preload: get});
}

export const BookingPage = lazyWithPreload(() => import('../pages/public/BookingPage'));
export const LoginPage = lazyWithPreload(() => import('../pages/LoginPage'));
export const StaffArea = lazyWithPreload(() => import('../components/admin/AdminLayout').then((m) => ({default: m.StaffArea})));
export const DashboardPage = lazyWithPreload(() => import('../pages/admin/DashboardPage'));
export const AppointmentsView = lazyWithPreload(() => import('../pages/admin/AppointmentsView'));
export const CalendarPage = lazyWithPreload(() => import('../pages/admin/CalendarPage'));
export const ServicesPage = lazyWithPreload(() => import('../pages/admin/ServicesPage'));
export const BarbersPage = lazyWithPreload(() => import('../pages/admin/BarbersPage'));
export const GalleryPage = lazyWithPreload(() => import('../pages/admin/GalleryPage'));
export const ReviewsPage = lazyWithPreload(() => import('../pages/admin/ReviewsPage'));
export const UsersPage = lazyWithPreload(() => import('../pages/admin/UsersPage'));
export const SettingsPage = lazyWithPreload(() => import('../pages/admin/SettingsPage'));
export const TimeOffPage = lazyWithPreload(() => import('../pages/admin/TimeOffPage'));

function whenIdle(cb: () => void) {
  const w = window as Window & {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number};
  if (w.requestIdleCallback) w.requestIdleCallback(cb, {timeout: 3000});
  else setTimeout(cb, 1500);
}

/** Mijozlar uchun: zapis va login sahifalari — sayt ochilgach, brauzer bo'sh paytida */
export function preloadPublic() {
  whenIdle(() => {
    BookingPage.preload();
    LoginPage.preload();
  });
}

/** Xodimlar uchun: login sahifasiga kirilganda yoki tizimga kirgandan keyin — admin bo'limlari */
export function preloadStaff() {
  whenIdle(() => {
    for (const p of [StaffArea, DashboardPage, AppointmentsView, CalendarPage, TimeOffPage, ServicesPage, BarbersPage, GalleryPage, ReviewsPage, UsersPage, SettingsPage]) p.preload();
  });
}
