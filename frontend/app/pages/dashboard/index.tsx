import { defineComponent, onMounted, computed, ref } from 'vue'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS, USER_ROLES, BOOKING_STATUS, HIRE_STATUS, PAYMENT_STATUS, EVENT_STATUS } from '~/utils/constants'
import type { BookingListInfo, HireListInfo, PaymentListInfo, Event } from '~/utils/types'
import { useRouter } from 'vue-router'

definePageMeta({
  middleware: 'auth',
})

interface DashboardStats {
  bookings: {
    total: number
    pending: number
    confirmed: number
    completed: number
  }
  events: {
    total: number
    upcoming: number
    active: number
  }
  hires: {
    total: number
    pending: number
    confirmed: number
  }
  payments: {
    total: number
    pending: number
    succeeded: number
    totalAmount: number
  }
  venues: {
    total: number
    published: number
  }
}

export default defineComponent({
  name: 'DashboardPage',
  setup() {
    const userStore = useUserStore()
    const $api = useApi()
    const router = useRouter()

    const loading = ref(true)
    const stats = ref<DashboardStats>({
      bookings: { total: 0, pending: 0, confirmed: 0, completed: 0 },
      events: { total: 0, upcoming: 0, active: 0 },
      hires: { total: 0, pending: 0, confirmed: 0 },
      payments: { total: 0, pending: 0, succeeded: 0, totalAmount: 0 },
      venues: { total: 0, published: 0 },
    })

    const recentBookings = ref<BookingListInfo[]>([])
    const recentEvents = ref<Event[]>([])
    const recentHires = ref<HireListInfo[]>([])
    const recentPayments = ref<PaymentListInfo[]>([])

    const userRole = computed(() => userStore.user?.role ?? 'unknown')
    const userRoleDisplay = computed(() => USER_ROLES[userRole.value])

    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
      }).format(amount)
    }

    const formatDate = (dateStr: string): string => {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    }

    const loadDashboardData = async () => {
      loading.value = true
      try {
        // Загружаем данные параллельно
        const [bookingsRes, eventsRes, hiresRes, paymentsRes] = await Promise.all([
          $api.get<{ results: BookingListInfo[]; count: number }>(API_ENDPOINTS.bookings.my, {
            params: { page_size: 5 },
          }),
          $api.get<{ results: Event[]; count: number }>(API_ENDPOINTS.events.my, {
            params: { page_size: 5 },
          }),
          $api.get<{ results: HireListInfo[]; count: number }>(API_ENDPOINTS.hires.my, {
            params: { page_size: 5 },
          }),
          $api.get<{ results: PaymentListInfo[]; count: number }>(API_ENDPOINTS.payments.my, {
            params: { page_size: 5 },
          }),
        ])

        recentBookings.value = bookingsRes.results || []
        recentEvents.value = eventsRes.results || []
        recentHires.value = hiresRes.results || []
        recentPayments.value = paymentsRes.results || []

        // Считаем статистику
        stats.value.bookings.total = bookingsRes.count || 0
        stats.value.bookings.pending = bookingsRes.results?.filter((b) => b.status === 'pending').length || 0
        stats.value.bookings.confirmed = bookingsRes.results?.filter((b) => b.status === 'confirmed').length || 0
        stats.value.bookings.completed = bookingsRes.results?.filter((b) => b.status === 'completed').length || 0

        stats.value.events.total = eventsRes.count || 0
        stats.value.events.upcoming = eventsRes.results?.filter((e) => e.is_upcoming).length || 0
        stats.value.events.active = eventsRes.results?.filter((e) => e.status === 'active' || e.status === 'ongoing').length || 0

        stats.value.hires.total = hiresRes.count || 0
        stats.value.hires.pending = hiresRes.results?.filter((h) => h.status === 'pending').length || 0
        stats.value.hires.confirmed = hiresRes.results?.filter((h) => h.status === 'confirmed').length || 0

        stats.value.payments.total = paymentsRes.count || 0
        stats.value.payments.pending = paymentsRes.results?.filter((p) => p.status === 'pending').length || 0
        stats.value.payments.succeeded = paymentsRes.results?.filter((p) => p.status === 'succeeded').length || 0
        stats.value.payments.totalAmount =
          paymentsRes.results?.reduce((sum, p) => sum + p.amount, 0) || 0

        // Площадки загружаем отдельно если пользователь owner
        if (userRole.value === 'owner') {
          try {
            const venuesRes = await $api.get<{ results: any[]; count: number }>(API_ENDPOINTS.venues.my, {
              params: { page_size: 1 },
            })
            stats.value.venues.total = venuesRes.count || 0
          } catch {
            // Игнорируем ошибки
          }
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      loadDashboardData()
    })

    const getStatusColor = (status: string): string => {
      const colors: Record<string, string> = {
        pending: '#f59e0b',
        confirmed: '#3b82f6',
        completed: '#10b981',
        cancelled: '#ef4444',
        succeeded: '#10b981',
        failed: '#ef4444',
        active: '#06b6d4',
        ongoing: '#22c55e',
        planned: '#6366f1',
      }
      return colors[status] || '#6b7280'
    }

    const getStatusLabel = (status: string, type: 'booking' | 'event' | 'hire' | 'payment'): string => {
      const maps = {
        booking: BOOKING_STATUS as Record<string, string>,
        event: EVENT_STATUS as Record<string, string>,
        hire: HIRE_STATUS as Record<string, string>,
        payment: PAYMENT_STATUS as Record<string, string>,
      }
      return maps[type][status] || status
    }

    return () => (
      <div class="dashboard-page">
        <div class="container">
          <div class="dashboard-header">
            <div>
              <h1 class="dashboard-title">Дашборд</h1>
              <p class="dashboard-subtitle">
                Обзор вашей активности на платформе
              </p>
            </div>
            <div class="dashboard-role-badge">
              {userRoleDisplay.value}
            </div>
          </div>

          {loading.value ? (
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Загрузка данных...</p>
            </div>
          ) : (
            <>
              {/* Статистика */}
              <div class="stats-grid">
                <div class="stat-card" onClick={() => router.push('/dashboard/bookings')}>
                  <div class="stat-icon">📅</div>
                  <div class="stat-info">
                    <div class="stat-value">{stats.value.bookings.total}</div>
                    <div class="stat-label">Бронирования</div>
                  </div>
                </div>

                <div class="stat-card" onClick={() => router.push('/dashboard/events')}>
                  <div class="stat-icon">🎉</div>
                  <div class="stat-info">
                    <div class="stat-value">{stats.value.events.total}</div>
                    <div class="stat-label">Мероприятия</div>
                  </div>
                </div>

                <div class="stat-card" onClick={() => router.push('/dashboard/hires')}>
                  <div class="stat-icon">👥</div>
                  <div class="stat-info">
                    <div class="stat-value">{stats.value.hires.total}</div>
                    <div class="stat-label">Наймы</div>
                  </div>
                </div>

                <div class="stat-card" onClick={() => router.push('/dashboard/payments')}>
                  <div class="stat-icon">💳</div>
                  <div class="stat-info">
                    <div class="stat-value">{formatCurrency(stats.value.payments.totalAmount)}</div>
                    <div class="stat-label">Оплачено</div>
                  </div>
                </div>

                {userRole.value === 'owner' && (
                  <div class="stat-card" onClick={() => router.push('/dashboard/venues')}>
                    <div class="stat-icon">🏛️</div>
                    <div class="stat-info">
                      <div class="stat-value">{stats.value.venues.total}</div>
                      <div class="stat-label">Площадки</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Последние бронирования */}
              {recentBookings.value.length > 0 && (
                <div class="section">
                  <div class="section-header">
                    <h2 class="section-title">Последние бронирования</h2>
                    <a href="/dashboard/bookings" class="section-link">
                      Все бронирования →
                    </a>
                  </div>
                  <div class="table-container">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Площадка</th>
                          <th>Мероприятие</th>
                          <th>Дата</th>
                          <th>Сумма</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.value.map((booking) => (
                          <tr>
                            <td>
                              <div class="cell-main">{booking.venue_name}</div>
                              <div class="cell-sub">{booking.venue_city}</div>
                            </td>
                            <td>{booking.event_title}</td>
                            <td>{formatDate(booking.start_datetime)}</td>
                            <td class="cell-price">{formatCurrency(booking.total_price)}</td>
                            <td>
                              <span
                                class="status-badge"
                                style={{ backgroundColor: getStatusColor(booking.status) }}
                              >
                                {getStatusLabel(booking.status, 'booking')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Последние мероприятия */}
              {recentEvents.value.length > 0 && (
                <div class="section">
                  <div class="section-header">
                    <h2 class="section-title">Последние мероприятия</h2>
                    <a href="/dashboard/events" class="section-link">
                      Все мероприятия →
                    </a>
                  </div>
                  <div class="table-container">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Название</th>
                          <th>Дата</th>
                          <th>Тематика</th>
                          <th>Гостей</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentEvents.value.map((event) => (
                          <tr>
                            <td class="cell-main">{event.title}</td>
                            <td>{formatDate(event.date)}</td>
                            <td>{event.theme_display}</td>
                            <td>{event.expected_guests}</td>
                            <td>
                              <span
                                class="status-badge"
                                style={{ backgroundColor: getStatusColor(event.status) }}
                              >
                                {getStatusLabel(event.status, 'event')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Последние наймы */}
              {recentHires.value.length > 0 && (
                <div class="section">
                  <div class="section-header">
                    <h2 class="section-title">Последние наймы</h2>
                    <a href="/dashboard/hires" class="section-link">
                      Все наймы →
                    </a>
                  </div>
                  <div class="table-container">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Специалист</th>
                          <th>Мероприятие</th>
                          <th>Дата</th>
                          <th>Сумма</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentHires.value.map((hire) => (
                          <tr>
                            <td>
                              <div class="cell-main">{hire.specialist_name}</div>
                              <div class="cell-sub">{hire.specialist_specialty}</div>
                            </td>
                            <td>{hire.event_title}</td>
                            <td>{formatDate(hire.start_datetime)}</td>
                            <td class="cell-price">{formatCurrency(hire.total_price)}</td>
                            <td>
                              <span
                                class="status-badge"
                                style={{ backgroundColor: getStatusColor(hire.status) }}
                              >
                                {getStatusLabel(hire.status, 'hire')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Последние платежи */}
              {recentPayments.value.length > 0 && (
                <div class="section">
                  <div class="section-header">
                    <h2 class="section-title">Последние платежи</h2>
                    <a href="/dashboard/payments" class="section-link">
                      Все платежи →
                    </a>
                  </div>
                  <div class="table-container">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Тип</th>
                          <th>Описание</th>
                          <th>Сумма</th>
                          <th>Дата</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPayments.value.map((payment) => (
                          <tr>
                            <td>
                              <span class="type-badge">
                                {payment.target_type === 'booking' ? '📅 Бронь' : '👥 Найм'}
                              </span>
                            </td>
                            <td class="cell-main">
                              {payment.target_type === 'booking' ? 'Бронирование' : 'Найм специалиста'}
                            </td>
                            <td class="cell-price">{formatCurrency(payment.amount)}</td>
                            <td>{formatDate(payment.created_at)}</td>
                            <td>
                              <span
                                class="status-badge"
                                style={{ backgroundColor: getStatusColor(payment.status) }}
                              >
                                {getStatusLabel(payment.status, 'payment')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Пустое состояние */}
              {!loading.value &&
                recentBookings.value.length === 0 &&
                recentEvents.value.length === 0 &&
                recentHires.value.length === 0 &&
                recentPayments.value.length === 0 && (
                  <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <h3>Пока нет данных</h3>
                    <p>Начните с бронирования площадки или создания мероприятия</p>
                    <div class="empty-actions">
                      <a href="/venues" class="btn btn--primary">
                        Найти площадку
                      </a>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    )
  },
})
