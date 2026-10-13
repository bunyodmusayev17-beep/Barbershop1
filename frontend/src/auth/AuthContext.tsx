import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {authApi} from '../api/admin';
import {auth} from '../api/client';
import type {LoginResponse, UserDto} from '../api/types';

type AuthState = {
  user: UserDto | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<UserDto>;
  logout: () => void;
  /** Tayyor sessiyani o'rnatish (Mini App'dan parolsiz kirish). */
  setSession: (res: LoginResponse) => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(() => !!auth.token);

  // Saqlangan token bo'lsa — foydalanuvchini tiklash
  useEffect(() => {
    if (!auth.token) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => (auth.token = null))
      .finally(() => setLoading(false));
  }, []);

  // Har qanday so'rov 401 qaytarsa — chiqish
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('nyb:logout', onLogout);
    return () => window.removeEventListener('nyb:logout', onLogout);
  }, []);

  const login = useCallback(async (login: string, password: string) => {
    const res = await authApi.login(login, password);
    auth.token = res.token;
    setUser(res.user);
    return res.user;
  }, []);

  const setSession = useCallback((res: LoginResponse) => {
    auth.token = res.token;
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    auth.token = null;
    setUser(null);
  }, []);

  const value = useMemo(() => ({user, loading, login, logout, setSession}), [user, loading, login, logout, setSession]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth faqat AuthProvider ichida');
  return v;
}
