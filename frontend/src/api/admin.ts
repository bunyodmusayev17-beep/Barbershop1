import {api} from './client';
import type {LocalizedText, LoginResponse, UserDto} from './types';

export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'NoShow';
/** Backend enum qiymatlari (raqam) */
export const STATUS_VALUE: Record<AppointmentStatus, number> = {Pending: 0, Confirmed: 1, Completed: 2, Cancelled: 3, NoShow: 4};
export const STATUSES: AppointmentStatus[] = ['Pending', 'Confirmed', 'Completed', 'NoShow', 'Cancelled'];

export type Appointment = {
  id: number;
  barberId: number;
  barberName: string;
  serviceId: number;
  serviceName: LocalizedText;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  endTime: string;
  status: AppointmentStatus;
  price: number;
  comment: string | null;
  language: string;
  createdAt: string;
};

export type Stats = {
  todayCount: number;
  todayRevenue: number;
  weekCount: number;
  weekRevenue: number;
  upcomingCount: number;
  noShowWeek: number;
  last7Days: {date: string; count: number; revenue: number}[];
  barbers: {barberId: number; name: string; todayCount: number; weekCount: number; weekRevenue: number}[];
  nextUp: Appointment[];
};

export type ServiceAdmin = {
  id: number;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  durationMinutes: number;
  sortOrder: number;
  isActive: boolean;
  barberIds: number[];
};
export type ServiceInput = Omit<ServiceAdmin, 'id'>;

export type Hours = {day: number; start: string; end: string; isDayOff: boolean};
export type TimeOff = {id: number; from: string; to: string; reason: string | null};
export type BarberAdmin = {
  id: number;
  name: string;
  title: LocalizedText;
  bio: LocalizedText;
  photoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  serviceIds: number[];
  hours: Hours[];
  timeOffs: TimeOff[];
};
export type BarberInput = Pick<BarberAdmin, 'name' | 'title' | 'bio' | 'sortOrder' | 'isActive' | 'serviceIds' | 'hours'>;

export type GalleryItem = {id: number; url: string; caption: LocalizedText; sortOrder: number};
export type ReviewAdmin = {id: number; authorName: string; rating: number; text: string; isPublished: boolean; createdAt: string};
export type ReviewInput = Omit<ReviewAdmin, 'id' | 'createdAt'>;

export type UserAdmin = {
  id: number;
  login: string;
  email: string | null;
  role: 'Admin' | 'Barber';
  barberId: number | null;
  barberName: string | null;
  isActive: boolean;
  createdAt: string;
  telegram: string | null;
  telegramLinked: boolean;
};
export const ROLE_VALUE = {Admin: 0, Barber: 1} as const;

export type Settings = {
  businessName: string;
  address: LocalizedText;
  phone: string;
  telegram: string | null;
  instagram: string | null;
  latitude: number;
  longitude: number;
  rating: number;
  ratingCount: number;
  slotStepMinutes: number;
  minLeadMinutes: number;
  bookingHorizonDays: number;
};

const json = (method: string, body?: unknown): RequestInit => ({method, body: body === undefined ? undefined : JSON.stringify(body)});

export const authApi = {
  login: (login: string, password: string) => api<LoginResponse>('/api/auth/login', json('POST', {login, password})),
  me: () => api<UserDto>('/api/auth/me'),
  /** Mini App: Telegram imzolagan initData bilan parolsiz kirish. Xodim bo'lmasa — undefined (204). */
  telegram: (initData: string) => api<LoginResponse | undefined>('/api/auth/telegram', json('POST', {initData})),
};

export type StaffTimeOff = {id: number; barberId: number; barberName: string; from: string; to: string; reason: string | null};
export type StaffTimeOffResult = {timeOff: StaffTimeOff; conflicts: Appointment[]};

/** Ishlamaydigan vaqtlar: usta — o'zi uchun, admin — istalgan usta uchun */
export const timeOffApi = {
  list: (q: {from?: string; to?: string; barberId?: number | null} = {}) => {
    const p = new URLSearchParams();
    if (q.from) p.set('from', q.from);
    if (q.to) p.set('to', q.to);
    if (q.barberId) p.set('barberId', String(q.barberId));
    return api<StaffTimeOff[]>(`/api/staff/timeoffs?${p}`);
  },
  create: (t: {barberId?: number | null; from: string; to: string; reason?: string}) => api<StaffTimeOffResult>('/api/staff/timeoffs', json('POST', t)),
  remove: (id: number) => api<void>(`/api/staff/timeoffs/${id}`, json('DELETE')),
};

export const adminApi = {
  stats: () => api<Stats>('/api/admin/stats'),

  appointments: (q: {from?: string; to?: string; barberId?: number | null; status?: AppointmentStatus | ''; search?: string}) => {
    const p = new URLSearchParams();
    if (q.from) p.set('from', q.from);
    if (q.to) p.set('to', q.to);
    if (q.barberId) p.set('barberId', String(q.barberId));
    if (q.status) p.set('status', String(STATUS_VALUE[q.status]));
    if (q.search) p.set('search', q.search);
    return api<Appointment[]>(`/api/admin/appointments?${p}`);
  },
  setStatus: (id: number, status: AppointmentStatus) =>
    api<Appointment>(`/api/admin/appointments/${id}/status`, json('PATCH', {status: STATUS_VALUE[status]})),
  createAppointment: (b: {serviceId: number; barberId: number; date: string; time: string; clientName: string; clientPhone: string; comment?: string}) =>
    api<Appointment>('/api/admin/appointments', json('POST', b)),

  services: () => api<ServiceAdmin[]>('/api/admin/services'),
  createService: (s: ServiceInput) => api<ServiceAdmin>('/api/admin/services', json('POST', s)),
  updateService: (id: number, s: ServiceInput) => api<ServiceAdmin>(`/api/admin/services/${id}`, json('PUT', s)),
  deleteService: (id: number) => api<void>(`/api/admin/services/${id}`, json('DELETE')),

  barbers: () => api<BarberAdmin[]>('/api/admin/barbers'),
  createBarber: (b: BarberInput) => api<BarberAdmin>('/api/admin/barbers', json('POST', b)),
  updateBarber: (id: number, b: BarberInput) => api<BarberAdmin>(`/api/admin/barbers/${id}`, json('PUT', b)),
  deleteBarber: (id: number) => api<void>(`/api/admin/barbers/${id}`, json('DELETE')),
  uploadBarberPhoto: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api<BarberAdmin>(`/api/admin/barbers/${id}/photo`, {method: 'POST', body: fd});
  },
  deleteBarberPhoto: (id: number) => api<BarberAdmin>(`/api/admin/barbers/${id}/photo`, json('DELETE')),
  addTimeOff: (id: number, t: {from: string; to: string; reason?: string}) => api<BarberAdmin>(`/api/admin/barbers/${id}/timeoffs`, json('POST', t)),
  deleteTimeOff: (id: number, timeOffId: number) => api<BarberAdmin>(`/api/admin/barbers/${id}/timeoffs/${timeOffId}`, json('DELETE')),

  gallery: () => api<GalleryItem[]>('/api/admin/gallery'),
  uploadGallery: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    return api<GalleryItem[]>('/api/admin/gallery', {method: 'POST', body: fd});
  },
  updateGallery: (id: number, caption: LocalizedText, sortOrder: number) => api<void>(`/api/admin/gallery/${id}`, json('PUT', {caption, sortOrder})),
  deleteGallery: (id: number) => api<void>(`/api/admin/gallery/${id}`, json('DELETE')),

  reviews: () => api<ReviewAdmin[]>('/api/admin/reviews'),
  createReview: (r: ReviewInput) => api<ReviewAdmin>('/api/admin/reviews', json('POST', r)),
  updateReview: (id: number, r: ReviewInput) => api<void>(`/api/admin/reviews/${id}`, json('PUT', r)),
  deleteReview: (id: number) => api<void>(`/api/admin/reviews/${id}`, json('DELETE')),

  users: () => api<UserAdmin[]>('/api/admin/users'),
  createUser: (u: {login: string; email?: string; password: string; role: 'Admin' | 'Barber'; barberId: number | null; telegram: string | null}) =>
    api<UserAdmin>('/api/admin/users', json('POST', {...u, role: ROLE_VALUE[u.role]})),
  updateUser: (id: number, u: {email?: string | null; role: 'Admin' | 'Barber'; barberId: number | null; isActive: boolean; newPassword?: string; telegram: string | null}) =>
    api<UserAdmin>(`/api/admin/users/${id}`, json('PUT', {...u, role: ROLE_VALUE[u.role]})),
  deleteUser: (id: number) => api<void>(`/api/admin/users/${id}`, json('DELETE')),

  settings: () => api<Settings>('/api/admin/settings'),
  updateSettings: (s: Settings) => api<void>('/api/admin/settings', json('PUT', s)),
};
