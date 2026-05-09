import type { EventTheme, EventStatus, BookingStatus, HireStatus, PaymentStatus, VenueStatus, UserRole } from '~/utils/types'

// ============================================
// Роли пользователей
// ============================================

export const USER_ROLES: Record<UserRole, string> = {
  renter: 'Арендатор',
  owner: 'Владелец',
  specialist: 'Специалист',
  admin: 'Администратор',
  unknown: 'Неизвестно',
}

// ============================================
// Статусы площадок
// ============================================

export const VENUE_STATUS: Record<VenueStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликовано',
  archived: 'В архиве',
  moderation: 'На модерации',
}

export const VENUE_STATUS_COLORS: Record<VenueStatus, string> = {
  draft: 'gray',
  published: 'green',
  archived: 'slate',
  moderation: 'yellow',
}

// ============================================
// Статусы мероприятий
// ============================================

export const EVENT_STATUS: Record<EventStatus, string> = {
  draft: 'Черновик',
  planned: 'Запланировано',
  active: 'Идёт подготовка',
  ongoing: 'Проходит сейчас',
  completed: 'Завершено',
  cancelled: 'Отменено',
}

export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  draft: 'gray',
  planned: 'yellow',
  active: 'blue',
  ongoing: 'green',
  completed: 'green',
  cancelled: 'red',
}

// ============================================
// Тматики мероприятий
// ============================================

export const EVENT_THEMES: Record<EventTheme, string> = {
  party: 'Вечеринка / День рождения',
  wedding: 'Свадьба',
  corporate: 'Корпоратив / Тимбилдинг',
  conference: 'Конференция / Семинар',
  workshop: 'Мастер-класс / Тренинг',
  photo_session: 'Фотосессия / Съёмка',
  concert: 'Концерт / Выступление',
  private: 'Закрытое мероприятие',
  other: 'Другое',
}

export const EVENT_THEME_ICONS: Record<EventTheme, string> = {
  party: '🎉',
  wedding: '💒',
  corporate: '🏢',
  conference: '🎤',
  workshop: '🛠️',
  photo_session: '📸',
  concert: '🎵',
  private: '🔒',
  other: '📌',
}

// ============================================
// Статусы бронирований
// ============================================

export const BOOKING_STATUS: Record<BookingStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждено',
  cancelled: 'Отменено',
  completed: 'Завершено',
}

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'yellow',
  confirmed: 'blue',
  cancelled: 'red',
  completed: 'green',
}

// ============================================
// Статусы наймов
// ============================================

export const HIRE_STATUS: Record<HireStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждено',
  cancelled: 'Отменено',
  completed: 'Выполнено',
}

export const HIRE_STATUS_COLORS: Record<HireStatus, string> = {
  pending: 'yellow',
  confirmed: 'blue',
  cancelled: 'red',
  completed: 'green',
}

// ============================================
// Статусы платежей
// ============================================

export const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  pending: 'Ожидает оплаты',
  succeeded: 'Оплачено',
  failed: 'Не удалось',
  cancelled: 'Отменён',
  refunded: 'Возвращён',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'yellow',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'gray',
  refunded: 'slate',
}

// ============================================
// API настройки
// ============================================

export const API_ENDPOINTS = {
  // Auth
  auth: {
    register: '/auth/register/',
    login: '/auth/login/',
    logout: '/auth/logout/',
    refresh: '/auth/token/refresh/',
    me: '/auth/me/',
    changePassword: '/auth/change-password/',
  },
  // Venues
  venues: {
    list: '/venues/',
    my: '/venues/my/',
    detail: (id: string) => `/venues/${id}/`,
    bySlug: (slug: string) => `/venues/slug/${slug}/`,
    images: (id: string) => `/venues/${id}/images/`,
    deleteImage: (id: string, imageId: number) => `/venues/${id}/images/${imageId}/`,
    availability: (id: string) => `/venues/${id}/availability/`,
  },
  // Events
  events: {
    list: '/events/',
    my: '/events/my/',
    detail: (id: string) => `/events/${id}/`,
    status: (id: string) => `/events/${id}/status/`,
  },
  // Bookings
  bookings: {
    list: '/bookings/',
    my: '/bookings/my/',
    detail: (id: string) => `/bookings/${id}/`,
    status: (id: string) => `/bookings/${id}/status/`,
  },
  // Hires
  hires: {
    list: '/hires/',
    my: '/hires/my/',
    specialist: '/hires/specialist/',
    detail: (id: string) => `/hires/${id}/`,
    status: (id: string) => `/hires/${id}/status/`,
    specialistAvailability: (id: string) => `/hires/specialist/${id}/availability/`,
  },
  // Specialists
  specialists: {
    list: '/specialists/',
    detail: (id: string) => `/specialists/${id}/`,
  },
  // Payments
  payments: {
    list: '/payments/',
    my: '/payments/my/',
    detail: (id: string) => `/payments/${id}/`,
    status: (id: string) => `/payments/${id}/status/`,
    byBooking: (id: string) => `/payments/booking/${id}/`,
    byHire: (id: string) => `/payments/hire/${id}/`,
  },
} as const

// ============================================
// Пагинация
// ============================================

export const DEFAULT_PAGE_SIZE = 12
export const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]

// ============================================
// Даты
// ============================================

export const DATE_FORMAT = 'DD.MM.YYYY'
export const DATETIME_FORMAT = 'DD.MM.YYYY HH:mm'
export const TIME_FORMAT = 'HH:mm'

// ============================================
// Валюта
// ============================================

export const CURRENCY = '₽'
export const CURRENCY_LOCALE = 'ru-RU'
