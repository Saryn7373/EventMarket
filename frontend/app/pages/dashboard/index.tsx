import { defineComponent, onMounted, computed, ref } from 'vue'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import {
  API_ENDPOINTS,
  USER_ROLES,
  BOOKING_STATUS_COLORS,
  HIRE_STATUS_COLORS,
  EVENT_STATUS_COLORS,
  VENUE_STATUS,
  VENUE_STATUS_COLORS,
  EVENT_THEME_ICONS,
} from '~/utils/constants'
import type {
  BookingListInfo,
  HireListInfo,
  Event,
  Venue,
} from '~/utils/types'
import { useRouter } from 'vue-router'

definePageMeta({
  middleware: 'auth',
})

export default defineComponent({
  name: 'DashboardPage',
  setup() {
    const userStore = useUserStore()
    const $api = useApi()
    const router = useRouter()

    const loading = ref(true)
    const errorMessage = ref<string | null>(null)

    // Данные арендатора
    const myEvents = ref<Event[]>([])
    const myBookings = ref<BookingListInfo[]>([])
    const myHires = ref<HireListInfo[]>([])

    // Данные владельца
    const myVenues = ref<Venue[]>([])
    const venueBookings = ref<BookingListInfo[]>([])

    // Данные специалиста
    const specialistHires = ref<HireListInfo[]>([])

    const userRole = computed(() => userStore.user?.role ?? 'unknown')
    const userRoleDisplay = computed(() => USER_ROLES[userRole.value])

    const formatCurrency = (amount: number): string =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
      }).format(amount)

    const formatDate = (dateStr: string): string =>
      new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })

    const formatDateTime = (dateStr: string): string =>
      new Date(dateStr).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

    const fetchAll = async <T,>(endpoint: string): Promise<T[]> => {
      const res = await $api.get<{ results: T[]; count: number }>(endpoint, {
        params: { page_size: 100 },
      })
      return res.results || []
    }

    const loadDashboardData = async () => {
      loading.value = true
      errorMessage.value = null

      try {
        switch (userRole.value) {
          case 'renter': {
            const [events, bookings, hires] = await Promise.all([
              fetchAll<Event>(API_ENDPOINTS.events.my),
              fetchAll<BookingListInfo>(API_ENDPOINTS.bookings.my),
              fetchAll<HireListInfo>(API_ENDPOINTS.hires.my),
            ])
            myEvents.value = events
            myBookings.value = bookings
            myHires.value = hires
            break
          }
          case 'owner': {
            const [venues, bookings] = await Promise.all([
              fetchAll<Venue>(API_ENDPOINTS.venues.my),
              fetchAll<BookingListInfo>(API_ENDPOINTS.bookings.my),
            ])
            myVenues.value = venues
            venueBookings.value = bookings
            break
          }
          case 'specialist': {
            specialistHires.value = await fetchAll<HireListInfo>(
              API_ENDPOINTS.hires.specialist,
            )
            break
          }
          default:
            break
        }
      } catch (err: any) {
        errorMessage.value = err.message || 'Не удалось загрузить данные'
        console.error('Dashboard load error:', err)
      } finally {
        loading.value = false
      }
    }

    onMounted(loadDashboardData)

    // ─── Группировка для арендатора ─────────────────────────
    const bookingsByEvent = computed(() => {
      const map = new Map<string, BookingListInfo[]>()
      for (const b of myBookings.value) {
        const list = map.get(b.event_id) ?? []
        list.push(b)
        map.set(b.event_id, list)
      }
      return map
    })

    const hiresByEvent = computed(() => {
      const map = new Map<string, HireListInfo[]>()
      for (const h of myHires.value) {
        const list = map.get(h.event_id) ?? []
        list.push(h)
        map.set(h.event_id, list)
      }
      return map
    })

    // ─── Хелперы рендера ────────────────────────────────────
    const renderStatusBadge = (label: string, color: string) => (
      <span class={`badge badge--${color}`}>
        <span class="sr-only">Статус: </span>
        {label}
      </span>
    )

    const renderEmpty = (icon: string, title: string, hint: string, action?: { label: string; onClick: () => void }) => (
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">{icon}</div>
        <h3 class="empty-state-title">{title}</h3>
        <p>{hint}</p>
        {action && (
          <button type="button" class="btn btn--primary" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    )

    // ─── Renter view ────────────────────────────────────────
    const renderRenter = () => (
      <>
        <div class="dashboard-toolbar">
          <button
            type="button"
            class="btn btn--primary"
            onClick={() => router.push('/dashboard/events/new')}
          >
            <span aria-hidden="true">+</span> Создать мероприятие
          </button>
        </div>

        {myEvents.value.length === 0 ? (
          renderEmpty(
            '🎉',
            'У вас пока нет мероприятий',
            'Создайте первое мероприятие, чтобы бронировать площадки и нанимать специалистов',
            {
              label: '+ Создать мероприятие',
              onClick: () => router.push('/dashboard/events/new'),
            },
          )
        ) : (
          <ul class="event-list" aria-label="Список ваших мероприятий">
            {myEvents.value.map((event) => {
              const bookings = bookingsByEvent.value.get(event.id) ?? []
              const hires = hiresByEvent.value.get(event.id) ?? []
              const themeIcon = EVENT_THEME_ICONS[event.theme] ?? '📌'
              const titleId = `event-${event.id}-title`

              return (
                <li>
                  <article class="event-card" aria-labelledby={titleId}>
                    <header class="event-card-header">
                      <div class="event-card-title-block">
                        <h3 id={titleId} class="event-card-title">
                          <span class="event-card-icon" aria-hidden="true">{themeIcon}</span>
                          <a class="event-card-link" href={`/events/${event.id}`}>
                            {event.title}
                          </a>
                        </h3>
                        <div class="event-card-meta">
                          <span>{formatDate(event.date)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{event.theme_display}</span>
                          <span aria-hidden="true">·</span>
                          <span>{event.expected_guests} гостей</span>
                        </div>
                      </div>
                      {renderStatusBadge(
                        event.status_display,
                        EVENT_STATUS_COLORS[event.status] ?? 'gray',
                      )}
                    </header>

                    <div class="event-card-body">
                      <section class="event-subsection" aria-label={`Бронирования мероприятия ${event.title}`}>
                        <h4 class="event-subsection-title">
                          Бронирования <span class="muted" aria-hidden="true">· {bookings.length}</span>
                          <span class="sr-only">: {bookings.length}</span>
                        </h4>
                        {bookings.length === 0 ? (
                          <p class="event-subsection-empty">Площадки ещё не забронированы</p>
                        ) : (
                          <ul class="event-subsection-list">
                            {bookings.map((b) => (
                              <li class="event-subsection-item">
                                <div class="event-subsection-item-main">
                                  <strong>{b.venue_name}</strong>
                                  <span class="muted"> · {b.venue_city}</span>
                                </div>
                                <div class="event-subsection-item-meta">
                                  <span>{formatDateTime(b.start_datetime)}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatCurrency(b.total_price)}</span>
                                </div>
                                {renderStatusBadge(
                                  b.status_display,
                                  BOOKING_STATUS_COLORS[b.status] ?? 'gray',
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section class="event-subsection" aria-label={`Наймы специалистов мероприятия ${event.title}`}>
                        <h4 class="event-subsection-title">
                          Наймы специалистов <span class="muted" aria-hidden="true">· {hires.length}</span>
                          <span class="sr-only">: {hires.length}</span>
                        </h4>
                        {hires.length === 0 ? (
                          <p class="event-subsection-empty">Специалисты ещё не наняты</p>
                        ) : (
                          <ul class="event-subsection-list">
                            {hires.map((h) => (
                              <li class="event-subsection-item">
                                <div class="event-subsection-item-main">
                                  <strong>{h.specialist_name}</strong>
                                  <span class="muted"> · {h.specialist_specialty || '—'}</span>
                                </div>
                                <div class="event-subsection-item-meta">
                                  <span>{formatDateTime(h.start_datetime)}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatCurrency(h.total_price)}</span>
                                </div>
                                {renderStatusBadge(
                                  h.status_display,
                                  HIRE_STATUS_COLORS[h.status] ?? 'gray',
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </>
    )

    // ─── Owner view ─────────────────────────────────────────
    const renderOwner = () => (
      <>
        <div class="dashboard-toolbar">
          <button
            type="button"
            class="btn btn--primary"
            onClick={() => router.push('/dashboard/venues/new')}
          >
            <span aria-hidden="true">+</span> Зарегистрировать площадку
          </button>
        </div>

        <section class="dashboard-section" aria-labelledby="owner-venues-title">
          <div class="section-header">
            <h2 id="owner-venues-title" class="section-title">Мои площадки</h2>
          </div>

          {myVenues.value.length === 0 ? (
            renderEmpty(
              '🏛️',
              'У вас пока нет площадок',
              'Зарегистрируйте свою первую площадку, чтобы принимать бронирования',
              {
                label: '+ Зарегистрировать площадку',
                onClick: () => router.push('/dashboard/venues/new'),
              },
            )
          ) : (
            <ul class="venue-grid" aria-label="Список ваших площадок">
              {myVenues.value.map((venue) => {
                const titleId = `venue-${venue.id}-title`
                return (
                  <li>
                    <article class="venue-card" aria-labelledby={titleId}>
                      <header class="venue-card-header">
                        <h3 id={titleId} class="venue-card-title">
                          <a class="venue-card-link" href={`/venues/${venue.id}`}>
                            {venue.name}
                          </a>
                        </h3>
                        {renderStatusBadge(
                          VENUE_STATUS[venue.status] ?? venue.status,
                          VENUE_STATUS_COLORS[venue.status] ?? 'gray',
                        )}
                      </header>
                      <div class="venue-card-meta">
                        <div>{venue.city}, {venue.address}</div>
                        <div>
                          Вместимость: {venue.capacity_min}–{venue.capacity_max} чел.
                        </div>
                      </div>
                      <div class="venue-card-prices">
                        {venue.price_per_hour && (
                          <span>{formatCurrency(Number(venue.price_per_hour))} / час</span>
                        )}
                        {venue.price_per_day && (
                          <span>{formatCurrency(Number(venue.price_per_day))} / сутки</span>
                        )}
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section class="dashboard-section" aria-labelledby="owner-bookings-title">
          <div class="section-header">
            <h2 id="owner-bookings-title" class="section-title">Аренды моих площадок</h2>
          </div>

          {venueBookings.value.length === 0 ? (
            <div class="empty-state">
              <p>Пока никто не бронировал ваши площадки</p>
            </div>
          ) : (
            <div class="table-wrapper">
              <table class="data-table">
                <caption class="sr-only">Аренды ваших площадок</caption>
                <thead>
                  <tr>
                    <th scope="col">Площадка</th>
                    <th scope="col">Мероприятие</th>
                    <th scope="col">Период</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {venueBookings.value.map((b) => (
                    <tr>
                      <td>
                        <strong>{b.venue_name}</strong>
                        <div class="muted text-sm">{b.venue_city}</div>
                      </td>
                      <td>{b.event_title}</td>
                      <td>
                        <div>{formatDateTime(b.start_datetime)}</div>
                        <div class="muted text-sm">
                          до {formatDateTime(b.end_datetime)}
                        </div>
                      </td>
                      <td class="text-semibold">{formatCurrency(b.total_price)}</td>
                      <td>
                        {renderStatusBadge(
                          b.status_display,
                          BOOKING_STATUS_COLORS[b.status] ?? 'gray',
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    )

    // ─── Specialist view ────────────────────────────────────
    const renderSpecialist = () => (
      <section class="dashboard-section" aria-labelledby="specialist-hires-title">
        <div class="section-header">
          <h2 id="specialist-hires-title" class="section-title">
            Мероприятия, на которые меня наняли
          </h2>
        </div>

        {specialistHires.value.length === 0 ? (
          renderEmpty(
            '🤝',
            'Вас пока никто не нанял',
            'Когда арендаторы пригласят вас на мероприятие, они появятся здесь',
          )
        ) : (
          <div class="table-wrapper">
            <table class="data-table">
              <caption class="sr-only">Мероприятия, на которые вас наняли</caption>
              <thead>
                <tr>
                  <th scope="col">Мероприятие</th>
                  <th scope="col">Дата</th>
                  <th scope="col">Период работы</th>
                  <th scope="col">Часов</th>
                  <th scope="col">Гонорар</th>
                  <th scope="col">Статус</th>
                </tr>
              </thead>
              <tbody>
                {specialistHires.value.map((h) => (
                  <tr>
                    <td>
                      <strong>{h.event_title}</strong>
                    </td>
                    <td>{formatDate(h.event_date)}</td>
                    <td>
                      <div>{formatDateTime(h.start_datetime)}</div>
                      <div class="muted text-sm">
                        до {formatDateTime(h.end_datetime)}
                      </div>
                    </td>
                    <td>{h.duration_hours}</td>
                    <td class="text-semibold">{formatCurrency(h.total_price)}</td>
                    <td>
                      {renderStatusBadge(
                        h.status_display,
                        HIRE_STATUS_COLORS[h.status] ?? 'gray',
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )

    // ─── Заголовок ──────────────────────────────────────────
    const headerByRole: Record<string, { title: string; subtitle: string }> = {
      renter: {
        title: 'Мои мероприятия',
        subtitle: 'Создавайте мероприятия, бронируйте площадки и нанимайте специалистов',
      },
      owner: {
        title: 'Мои площадки',
        subtitle: 'Управляйте площадками и отслеживайте бронирования',
      },
      specialist: {
        title: 'Мои наймы',
        subtitle: 'Мероприятия, на которые вас пригласили',
      },
      admin: {
        title: 'Дашборд',
        subtitle: 'Администрирование платформы',
      },
      unknown: {
        title: 'Дашборд',
        subtitle: 'Профиль без роли — обратитесь к администратору',
      },
    }

    return () => {
      const header = headerByRole[userRole.value] ?? headerByRole.unknown

      return (
        <div class="dashboard-page">
          <div class="container">
            <header class="dashboard-header">
              <div>
                <h1 class="dashboard-title">{header.title}</h1>
                <p class="dashboard-subtitle">{header.subtitle}</p>
              </div>
              <div class="role-badge" aria-label={`Ваша роль: ${userRoleDisplay.value}`}>
                {userRoleDisplay.value}
              </div>
            </header>

            {loading.value && (
              <div class="empty-state" role="status" aria-live="polite">
                <div class="spinner" aria-hidden="true"></div>
                <p>Загрузка данных…</p>
              </div>
            )}

            {!loading.value && errorMessage.value && (
              <div class="empty-state" role="alert">
                <p>{errorMessage.value}</p>
              </div>
            )}

            {!loading.value && !errorMessage.value && (
              <>
                {userRole.value === 'renter' && renderRenter()}
                {userRole.value === 'owner' && renderOwner()}
                {userRole.value === 'specialist' && renderSpecialist()}
                {(userRole.value === 'admin' || userRole.value === 'unknown') && (
                  <div class="empty-state">
                    <p>Для вашей роли дашборд пока не настроен.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )
    }
  },
})
