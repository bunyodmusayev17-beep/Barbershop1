import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MotionConfig} from 'framer-motion';
import {Suspense, useEffect, useRef} from 'react';
import {BrowserRouter, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import {authApi} from './api/admin';
import {AuthProvider, useAuth} from './auth/AuthContext';
import {Layout} from './components/Layout';
import {Spinner} from './components/ui';
import {
  AppointmentsView,
  BarbersPage,
  BookingPage,
  CalendarPage,
  DashboardPage,
  GalleryPage,
  LoginPage,
  preloadPublic,
  preloadStaff,
  ReviewsPage,
  ServicesPage,
  SettingsPage,
  StaffArea,
  TimeOffPage,
  UsersPage,
} from './lib/pages';
import HomePage from './pages/public/HomePage';
import {inTelegram, tgInitData, webApp} from './lib/telegram';

const queryClient = new QueryClient({defaultOptions: {queries: {retry: 1, refetchOnWindowFocus: false}}});

/** "/#services" kabi havolalar: sahifa chizilgandan keyin bo'limga o'tish */
function ScrollManager() {
  const {pathname, hash} = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({top: 0});
      return;
    }
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
      else if (tries++ < 20) setTimeout(tick, 100);
    };
    tick();
  }, [pathname, hash]);
  return null;
}

/**
 * Sahifalar kodini oldindan yuklash: mijozlar uchun zapis/login darhol,
 * xodimlar uchun admin bo'limlari — login sahifasiga kirganda yoki tizimga kirgan bo'lsa.
 */
function Preloader() {
  const {pathname} = useLocation();
  const {user} = useAuth();
  useEffect(() => preloadPublic(), []);
  useEffect(() => {
    if (user || pathname.startsWith('/login') || pathname.startsWith('/admin') || pathname.startsWith('/barber')) preloadStaff();
  }, [user, pathname]);
  return null;
}

/**
 * Telegram Mini App: xodim bo'lsa parolsiz kirib o'z paneliga o'tadi (mijoz uchun sayt o'zgarmaydi);
 * Telegram'ning "Orqaga" tugmasi sayt ichidagi orqaga o'tish bilan ishlaydi.
 */
function TelegramBridge() {
  const {user, loading, setSession} = useAuth();
  const navigate = useNavigate();
  const {pathname} = useLocation();
  const tried = useRef(false);

  useEffect(() => {
    if (!inTelegram || !tgInitData || loading || user || tried.current) return;
    tried.current = true;
    authApi
      .telegram(tgInitData)
      .then((res) => {
        if (!res) return;
        setSession(res);
        if (pathname === '/') navigate(res.user.role === 'Admin' ? '/admin' : '/barber', {replace: true});
      })
      .catch(() => undefined);
  }, [loading, user, setSession, navigate, pathname]);

  useEffect(() => {
    const back = webApp()?.BackButton;
    if (!back) return;
    const isRoot = pathname === '/' || pathname === '/admin' || pathname === '/barber';
    if (isRoot) {
      back.hide();
      return;
    }
    const onBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
    back.show();
    back.onClick(onBack);
    return () => back.offClick(onBack);
  }, [pathname, navigate]);

  return null;
}

/** Sahifa kodi hali yuklanmagan bo'lsa: yuqorida yuguruvchi chiziq + spinner (hech qachon "muzlab" turmaydi) */
function Fallback() {
  return (
    <>
      <div className="route-progress" />
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-navy" />
      </div>
    </>
  );
}

function NotFound() {
  return (
    <div className="py-32 text-center">
      <p className="font-deco text-8xl text-cherry">404</p>
      <a href="/" className="mt-6 inline-block underline">
        New York Barbershop
      </a>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Telefonda "harakatni kamaytirish" yoqilgan bo'lsa — barcha animatsiyalar o'chadi */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <BrowserRouter>
            <ScrollManager />
            <Preloader />
            <TelegramBridge />
            <Suspense fallback={<Fallback />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="book" element={<BookingPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>

                <Route path="admin" element={<StaffArea role="Admin" />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="appointments" element={<AppointmentsView />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="barbers" element={<BarbersPage />} />
                  <Route path="timeoff" element={<TimeOffPage />} />
                  <Route path="gallery" element={<GalleryPage />} />
                  <Route path="reviews" element={<ReviewsPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route path="barber" element={<StaffArea role="Barber" />}>
                  <Route index element={<AppointmentsView />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="timeoff" element={<TimeOffPage />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
