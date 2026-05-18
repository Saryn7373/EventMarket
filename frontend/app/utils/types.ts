// ============================================
// Базовые типы
// ============================================

export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
}

// ============================================
// Аутентификация
// ============================================

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  role_display: string
  date_joined: string
  avatar: string | null
}

export type UserRole = 'renter' | 'owner' | 'specialist' | 'admin' | 'unknown'

export interface AuthTokens {
  access: string
  refresh: string
}

export interface RegisterPayload {
  email: string
  password: string
  password_confirm: string
  first_name: string
  last_name: string
  role: 'renter' | 'owner' | 'specialist'
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ChangePasswordPayload {
  old_password: string
  new_password: string
}

// ============================================
// Площадки (Venues)
// ============================================

export interface Venue extends BaseEntity {
  owner_email: string
  name: string
  slug: string
  description: string
  short_description: string
  address: string
  city: string
  postal_code: string
  latitude: number | null
  longitude: number | null
  capacity_min: number
  capacity_max: number
  area_sq_m: number | null
  price_per_hour: number | null
  price_per_day: number | null
  min_booking_hours: number
  cancellation_policy: string
  status: VenueStatus
  is_verified: boolean
  main_photo: string | null
  images: VenueImage[]
  has_active_bookings: boolean
}

export type VenueStatus = 'draft' | 'published' | 'archived' | 'moderation'

export interface VenueImage {
  id: number
  image: string
  order: number
  caption: string
  created_at: string
}

export interface VenueFilters {
  city?: string
  capacity_min?: number
  capacity_max?: number
  price_min?: number
  price_max?: number
  status?: VenueStatus
  search?: string
  ordering?: string
}

// ============================================
// Мероприятия (Events)
// ============================================

export interface Event extends BaseEntity {
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  theme: EventTheme
  theme_display: string
  short_description: string
  description: string
  expected_guests: number
  status: EventStatus
  status_display: string
  renter_info: RenterInfo
  venues: VenueShortInfo[]
  specialists: SpecialistInfo[]
  duration_hours: number | null
  is_upcoming: boolean
  is_today: boolean
}

export type EventTheme =
  | 'party'
  | 'wedding'
  | 'corporate'
  | 'conference'
  | 'workshop'
  | 'photo_session'
  | 'concert'
  | 'private'
  | 'other'

export type EventStatus = 'draft' | 'planned' | 'active' | 'ongoing' | 'completed' | 'cancelled'

export interface RenterInfo {
  email: string
  first_name: string
  last_name: string
}

export interface VenueShortInfo {
  id: string
  slug: string
  name: string
  city: string
  address: string
  booking_id: string
  booking_status: BookingStatus
  booking_status_display: string
}

export interface SpecialistInfo {
  id: string
  email: string
  first_name: string
  last_name: string
  specialty: string
  hire_id: string
  hire_status: HireStatus
  hire_status_display: string
}

export interface EventFilters {
  date_from?: string
  date_to?: string
  theme?: EventTheme
  status?: EventStatus
  upcoming?: boolean
  today?: boolean
  guests_min?: number
  guests_max?: number
  search?: string
  ordering?: string
}

// ============================================
// Бронирования (Bookings)
// ============================================

export interface Booking extends BaseEntity {
  venue: VenueShortInfo
  event: EventShortInfo
  renter: RenterInfo
  start_datetime: string
  end_datetime: string
  duration_hours: number
  total_price: number
  status: BookingStatus
  status_display: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface BookingListInfo {
  id: string
  venue_id: string
  venue_name: string
  venue_city: string
  event_id: string
  event_title: string
  event_date: string
  start_datetime: string
  end_datetime: string
  duration_hours: number
  total_price: number
  status: BookingStatus
  status_display: string
  created_at: string
}

export interface BookingFilters {
  status?: BookingStatus
  date_from?: string
  date_to?: string
  ordering?: string
}

export interface BusySlot {
  start_datetime: string
  end_datetime: string
  status: BookingStatus
}

// ============================================
// Наймы специалистов (Hires)
// ============================================

export interface Hire extends BaseEntity {
  event: EventShortInfo
  specialist: SpecialistDetailInfo
  start_datetime: string
  end_datetime: string
  duration_hours: number
  total_price: number
  status: HireStatus
  status_display: string
}

export type HireStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface EventShortInfo {
  id: string
  title: string
  date: string
  theme: string
}

export interface SpecialistDetailInfo {
  email: string
  first_name: string
  last_name: string
  specialty: string
  rating: number
}

export interface HireListInfo {
  id: string
  event_id: string
  event_title: string
  event_date: string
  specialist_name: string
  specialist_specialty: string
  start_datetime: string
  end_datetime: string
  duration_hours: number
  total_price: number
  status: HireStatus
  status_display: string
  created_at: string
}

export interface HireFilters {
  status?: HireStatus
  specialist?: string
  event?: string
  date_from?: string
  date_to?: string
  price_min?: number
  price_max?: number
  upcoming?: boolean
  ordering?: string
}

export interface SpecialistBusySlot {
  id: string
  start_datetime: string
  end_datetime: string
  status: HireStatus
  event_title: string
}

// ============================================
// Платежи (Payments)
// ============================================

export interface Payment extends BaseEntity {
  booking: BookingShortInfo | null
  hire: HireShortInfo | null
  payer: RenterInfo
  amount: number
  status: PaymentStatus
  status_display: string
  is_paid: boolean
  paid_at: string | null
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'

export interface BookingShortInfo {
  id: string
  venue_name: string
  event_title: string
  event_date: string
  total_price: number
}

export interface HireShortInfo {
  id: string
  specialist_name: string
  event_title: string
  event_date: string
  total_price: number
}

export interface PaymentListInfo {
  id: string
  target_type: 'booking' | 'hire' | null
  target_id: string | null
  amount: number
  status: PaymentStatus
  status_display: string
  created_at: string
  paid_at: string | null
}

export interface PaymentFilters {
  status?: PaymentStatus
  amount_min?: number
  amount_max?: number
  created_from?: string
  created_to?: string
  paid_from?: string
  paid_to?: string
  is_paid?: boolean
  ordering?: string
}

// ============================================
// Пагинация
// ============================================

export interface PaginationParams {
  page?: number
  page_size?: number
}

export interface PaginationMeta {
  count: number
  next: string | null
  previous: string | null
}

export interface PaginatedResponse<T> {
  results: T[]
  count: number
  next: string | null
  previous: string | null
}

// ============================================
// API Response
// ============================================

export interface ApiError {
  detail?: string
  [key: string]: any
}

export interface ApiValidationError {
  [field: string]: string[]
}

// ============================================
// Публичные специалисты
// ============================================

export interface SpecialistPublic {
  id: string
  first_name: string
  last_name: string
  specialty: string
  city: string
  rating: string
  portfolio_url: string
  avatar: string | null
}

export interface SpecialistDetail {
  id: string
  first_name: string
  last_name: string
  specialty: string
  license_number: string
  city: string
  rating: string
  portfolio_url: string
  avatar: string | null
}
