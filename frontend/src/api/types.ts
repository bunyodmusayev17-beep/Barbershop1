export type Lang = 'uz' | 'ru' | 'en';

export type LocalizedText = {uz: string; ru: string; en: string};

export type PublicHours = {day: number; open: string | null; close: string | null};

export type PublicSettings = {
  businessName: string;
  address: LocalizedText;
  phone: string;
  telegram: string | null;
  instagram: string | null;
  latitude: number;
  longitude: number;
  rating: number;
  ratingCount: number;
  bookingHorizonDays: number;
  hours: PublicHours[];
};

export type PublicService = {
  id: number;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  durationMinutes: number;
  barberIds: number[];
};

export type PublicBarber = {
  id: number;
  name: string;
  title: LocalizedText;
  bio: LocalizedText;
  photoUrl: string | null;
  serviceIds: number[];
  daysOff: number[];
};

export type PublicReview = {id: number; authorName: string; rating: number; text: string; createdAt: string};

export type PublicImage = {id: number; url: string; caption: LocalizedText};

export type SiteResponse = {
  settings: PublicSettings;
  services: PublicService[];
  barbers: PublicBarber[];
  reviews: PublicReview[];
  gallery: PublicImage[];
};

export type Slot = {time: string; barberIds: number[]};

export type SlotsResponse = {date: string; slots: Slot[]};

export type CreateBookingRequest = {
  serviceId: number;
  barberId: number | null;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  comment?: string;
  language: Lang;
};

export type BookingConfirmation = {
  id: number;
  barberId: number;
  barberName: string;
  serviceId: number;
  date: string;
  time: string;
  endTime: string;
  price: number;
  clientName: string;
  clientPhone: string;
};

export type UserDto = {id: number; login: string; role: 'Admin' | 'Barber'; barberId: number | null; barberName: string | null};

export type LoginResponse = {token: string; expiresAt: string; user: UserDto};
