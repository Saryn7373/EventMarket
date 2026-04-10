import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

import { DATE_FORMAT, DATETIME_FORMAT, TIME_FORMAT, CURRENCY, CURRENCY_LOCALE } from './constants'

// ============================================
// Даты
// ============================================

export function formatDate(date: string | Date, format: string = DATE_FORMAT): string {
  return dayjs(date).format(format)
}

export function formatDateTime(date: string | Date, format: string = DATETIME_FORMAT): string {
  return dayjs(date).format(format)
}

export function formatTime(date: string | Date, format: string = TIME_FORMAT): string {
  return dayjs(date).format(format)
}

export function formatRelative(date: string | Date): string {
  const now = dayjs()
  const target = dayjs(date)
  const diffDays = now.diff(target, 'day')
  const diffHours = now.diff(target, 'hour')
  const diffMinutes = now.diff(target, 'minute')

  if (diffMinutes < 1) return 'только что'
  if (diffMinutes < 60) return `${diffMinutes} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  return target.format(DATE_FORMAT)
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  const s = dayjs(start)
  const e = dayjs(end)

  if (s.isSame(e, 'day')) {
    return `${s.format(DATE_FORMAT)} ${s.format(TIME_FORMAT)} – ${e.format(TIME_FORMAT)}`
  }
  return `${s.format(DATE_FORMAT)} – ${e.format(DATE_FORMAT)}`
}

// ============================================
// Валюта
// ============================================

export function formatCurrency(amount: number | string, currency: string = CURRENCY): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num).replace('₽', currency.trim())
}

export function formatPricePerHour(price: number | string | null): string {
  if (!price) return 'По договорённости'
  return `${formatCurrency(price)} / час`
}

export function formatPricePerDay(price: number | string | null): string {
  if (!price) return 'По договорённости'
  return `${formatCurrency(price)} / день`
}

// ============================================
// Числа
// ============================================

export function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num
  return new Intl.NumberFormat(CURRENCY_LOCALE).format(n)
}

export function formatCapacity(min: number, max: number): string {
  return `${formatNumber(min)} – ${formatNumber(max)} чел.`
}

export function formatArea(area: number | null): string {
  if (!area) return '—'
  return `${formatNumber(area)} м²`
}

// ============================================
// Строки
// ============================================

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

export function formatInitials(firstName: string, lastName: string): string {
  const first = firstName.charAt(0).toUpperCase()
  const last = lastName.charAt(0).toUpperCase()
  return `${first}${last}`
}

export function formatFullName(firstName: string, lastName: string): string {
  const name = `${firstName} ${lastName}`.trim()
  return name || 'Аноним'
}

// ============================================
// Длительность
// ============================================

export function formatDuration(hours: number | null): string {
  if (!hours) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} мин.`
  if (hours === 1) return '1 час'
  if (hours < 5) return `${hours} часа`
  return `${hours} часов`
}

// ============================================
// URL
// ============================================

export function getFullImageUrl(path: string | null, baseUrl?: string): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${baseUrl || ''}${path}`
}
