import {useState} from 'react';
import {Navigate, useLocation, useNavigate} from 'react-router-dom';
import type {ApiError} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import {inputCls} from '../components/admin/kit';
import {BarberPole, Button, Ornament, Spinner} from '../components/ui';

export default function LoginPage() {
  const {user, login} = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({login: '', password: ''});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const home = (role: string) => (role === 'Admin' ? '/admin' : '/barber');
  const from = (location.state as {from?: string} | null)?.from;
  if (user) return <Navigate to={from ?? home(user.role)} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(form.login, form.password);
      nav(from ?? home(u.role), {replace: true});
    } catch (err) {
      const status = (err as ApiError).status;
      setError(status === 429 ? "Juda ko'p urinish. Bir daqiqadan keyin qayta urinib ko'ring." : "Login yoki parol noto'g'ri");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <form onSubmit={submit} className="w-full max-w-sm overflow-hidden rounded-3xl border-2 border-navy bg-white shadow-xl">
        <BarberPole />
        <div className="p-8">
          <Ornament className="text-navy">Xodimlar</Ornament>
          <h1 className="mt-3 text-center font-deco text-5xl text-cherry">Kirish</h1>
          {error ? (
            <p role="alert" className="mt-5 rounded-xl border-2 border-cherry bg-cherry/10 px-3 py-2 text-sm font-semibold text-cherry-dark">
              {error}
            </p>
          ) : null}
          <label className="mt-6 block">
            <span className="mb-1 block text-xs font-bold tracking-wider uppercase">Login</span>
            <input className={inputCls} value={form.login} onChange={(e) => setForm({...form, login: e.target.value})} autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-bold tracking-wider uppercase">Parol</span>
            <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} autoComplete="current-password" required />
          </label>
          <Button type="submit" className="mt-6 w-full" disabled={busy}>
            {busy ? <Spinner /> : 'Kirish'}
          </Button>
        </div>
      </form>
    </div>
  );
}
