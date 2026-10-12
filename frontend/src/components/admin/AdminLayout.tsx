import {Suspense, useEffect, useState} from 'react';
import {Link, Navigate, NavLink, Outlet, useLocation} from 'react-router-dom';
import {useAuth} from '../../auth/AuthContext';
import {cn} from '../../lib/cn';
import {Spinner} from '../ui';
import {ToastProvider} from './kit';

const ADMIN_NAV = [
  {to: '/admin', label: 'Boshqaruv', icon: '◆', end: true},
  {to: '/admin/appointments', label: 'Zapislar', icon: '☰'},
  {to: '/admin/calendar', label: 'Kalendar', icon: '▦'},
  {to: '/admin/services', label: 'Xizmatlar', icon: '✂'},
  {to: '/admin/barbers', label: 'Ustalar', icon: '☺'},
  {to: '/admin/timeoff', label: 'Ishlamaydigan kunlar', icon: '✚'},
  {to: '/admin/gallery', label: 'Galereya', icon: '▣'},
  {to: '/admin/reviews', label: 'Sharhlar', icon: '★'},
  {to: '/admin/users', label: 'Foydalanuvchilar', icon: '⚿'},
  {to: '/admin/settings', label: 'Sozlamalar', icon: '⚙'},
];

const BARBER_NAV = [
  {to: '/barber', label: 'Mening zapislarim', icon: '☰', end: true},
  {to: '/barber/calendar', label: 'Kalendar', icon: '▦'},
  {to: '/barber/timeoff', label: 'Ishlamayman', icon: '✚'},
];

/** Kirish talab qilinadigan bo'lim. role berilsa — faqat shu rol. */
export function StaffArea({role}: {role: 'Admin' | 'Barber'}) {
  const {user, loading, logout} = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{from: location.pathname}} />;
  if (user.role !== role) return <Navigate to={user.role === 'Admin' ? '/admin' : '/barber'} replace />;

  const nav = role === 'Admin' ? ADMIN_NAV : BARBER_NAV;
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#f6f1e6] lg:flex">
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-64 transform bg-navy text-cream transition lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
          <div className="barber-pole !h-2" />
          <div className="px-6 py-6">
            <Link to="/" className="block leading-none" title="Saytga o'tish">
              <span className="font-deco text-3xl">New York</span>
              <span className="mt-1 block font-deco text-[10px] tracking-[0.5em]">BARBERSHOP</span>
            </Link>
            <p className="mt-3 text-xs opacity-60">{role === 'Admin' ? 'Admin panel' : 'Usta kabineti'}</p>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({isActive}) =>
                  cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-wide transition', isActive ? 'bg-cherry text-white' : 'hover:bg-white/10')
                }
              >
                <span aria-hidden className="w-5 text-center">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4">
            <p className="text-sm font-bold">{user.barberName ?? user.login}</p>
            <p className="text-xs opacity-60">{user.role === 'Admin' ? 'Administrator' : 'Usta'}</p>
            <div className="mt-3 flex gap-2">
              <Link to="/" className="rounded-full border border-white/30 px-3 py-1 text-xs hover:bg-white/10">
                Sayt ↗
              </Link>
              <button type="button" onClick={logout} className="rounded-full border border-white/30 px-3 py-1 text-xs hover:bg-white/10">
                Chiqish
              </button>
            </div>
          </div>
        </aside>
        {open ? <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} /> : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-navy/10 bg-[#f6f1e6]/95 px-4 py-3 backdrop-blur lg:hidden">
            <button type="button" onClick={() => setOpen(true)} aria-label="Menyu" className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-navy">
              ☰
            </button>
            <span className="font-deco text-2xl text-cherry">New York</span>
            <span className="w-10" />
          </header>
          <main key={location.pathname} className="page-enter mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <Suspense
              fallback={
                <>
                  <div className="route-progress" />
                  <Spinner className="h-8 w-8 text-navy" />
                </>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
