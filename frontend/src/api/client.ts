import type {BookingConfirmation, CreateBookingRequest, SiteResponse, SlotsResponse} from './types';

const TOKEN_KEY = 'nyb_token';

export const auth = {
  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set token(value: string | null) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private rejim — token faqat shu sessiyada yo'qoladi */
    }
  },
};

/** Server xatosi: `code` — 3 tilda xabar ko'rsatish uchun (booking xatolari). */
export class ApiError extends Error {
  status: number;
  code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = auth.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, {...init, headers});
  if (res.status === 401 && token) {
    auth.token = null;
    window.dispatchEvent(new Event('nyb:logout'));
  }
  if (!res.ok) {
    let body: {title?: string; code?: string} = {};
    try {
      body = await res.json();
    } catch {
      /* bo'sh javob */
    }
    throw new ApiError(res.status, body.code, body.title ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const publicApi = {
  site: () => api<SiteResponse>('/api/public/site'),
  slots: (serviceId: number, date: string, barberId: number | null) =>
    api<SlotsResponse>(
      `/api/booking/slots?serviceId=${serviceId}&date=${date}${barberId ? `&barberId=${barberId}` : ''}`,
    ),
  book: (req: CreateBookingRequest) =>
    api<BookingConfirmation>('/api/booking', {method: 'POST', body: JSON.stringify(req)}),
};
