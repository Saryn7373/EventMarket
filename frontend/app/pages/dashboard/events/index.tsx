import { defineComponent, onMounted, ref, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS, EVENT_STATUS, EVENT_THEMES, EVENT_THEME_ICONS } from '~/utils/constants'
import type { Event, EventStatus } from '~/utils/types'
import UiButton from '~/components/ui/Button'
import UiSelect from '~/components/ui/Select'

definePageMeta({
  middleware: 'auth',
})

export default defineComponent({
  name: 'DashboardEventsPage',
  setup() {
    const $api = useApi()
    const loading = ref(true)
    const error = ref<string | null>(null)
    const events = ref<Event[]>([])
    const totalCount = ref(0)

    // Фильтры
    const statusFilter = ref<EventStatus | ''>('')
    const themeFilter = ref<string>('')
    const ordering = ref('-created_at')

    // Пагинация
    const currentPage = ref(1)
    const pageSize = ref(12)

    const statusOptions = computed(() => [
      { value: '', label: 'Все статусы' },
      ...Object.entries(EVENT_STATUS).map(([value, label]) => ({ value, label })),
    ])

    const themeOptions = computed(() => [
      { value: '', label: 'Все тематики' },
      ...Object.entries(EVENT_THEMES).map(([value, label]) => ({ value, label })),
    ])

    const orderingOptions = computed(() => [
      { value: '-created_at', label: 'Сначала новые' },
      { value: 'created_at', label: 'Сначала старые' },
      { value: '-date', label: 'По дате мероприятия (убыв.)' },
      { value: 'date', label: 'По дате мероприятия (возр.)' },
      { value: '-expected_guests', label: 'По гостям (убыв.)' },
      { value: 'expected_guests', label: 'По гостям (возр.)' },
    ])

    const formatDate = (dateStr: string): string => {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    }

    const formatDateTime = (dateStr: string): string => {
      return new Date(dateStr).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const loadEvents = async () => {
      loading.value = true
      error.value = null
      try {
        const params: Record<string, any> = {
          page: currentPage.value,
          page_size: pageSize.value,
        }
        if (statusFilter.value) {
          params.status = statusFilter.value
        }
        if (themeFilter.value) {
          params.theme = themeFilter.value
        }
        if (ordering.value) {
          params.ordering = ordering.value
        }

        const response = await $api.get<{ results: Event[]; count: number }>(
          API_ENDPOINTS.events.my,
          { params }
        )

        events.value = response.results || []
        totalCount.value = response.count || 0
      } catch (err: any) {
        error.value = err.message || 'Ошибка загрузки данных'
        console.error('Error loading events:', err)
      } finally {
        loading.value = false
      }
    }

    const handleFilterChange = () => {
      currentPage.value = 1
      loadEvents()
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      loadEvents()
    }

    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

    const getStatusColor = (status: EventStatus): string => {
      const colors: Record<string, string> = {
        draft: '#6b7280',
        planned: '#6366f1',
        active: '#06b6d4',
        ongoing: '#22c55e',
        completed: '#64748b',
        cancelled: '#ef4444',
      }
      return colors[status] || '#6b7280'
    }

    const getStatusLabel = (status: EventStatus): string => {
      return EVENT_STATUS[status] || status
    }

    onMounted(() => {
      loadEvents()
    })

    return () => (
      <div class="dashboard-events-page">
        <div class="container">
          <header class="page-header">
            <div>
              <h1 id="events-page-title" class="page-title">Мои мероприятия</h1>
              <p class="page-subtitle">Управление мероприятиями</p>
            </div>
            <a href="/events/create" class="btn btn--primary">
              <span aria-hidden="true">+</span> Создать мероприятие
            </a>
          </header>

          {/* Фильтры */}
          <form
            class="filters-bar"
            role="search"
            aria-label="Фильтры мероприятий"
            onSubmit={(e) => e.preventDefault()}
          >
            <div class="filter-item">
              <UiSelect
                id="events-filter-status"
                label="Статус"
                modelValue={statusFilter.value}
                onUpdate:modelValue={(val: any) => {
                  statusFilter.value = val
                  handleFilterChange()
                }}
                options={statusOptions.value}
              />
            </div>

            <div class="filter-item">
              <UiSelect
                id="events-filter-theme"
                label="Тематика"
                modelValue={themeFilter.value}
                onUpdate:modelValue={(val: any) => {
                  themeFilter.value = val
                  handleFilterChange()
                }}
                options={themeOptions.value}
              />
            </div>

            <div class="filter-item">
              <UiSelect
                id="events-filter-ordering"
                label="Сортировка"
                modelValue={ordering.value}
                onUpdate:modelValue={(val: any) => {
                  ordering.value = val
                  handleFilterChange()
                }}
                options={orderingOptions.value}
              />
            </div>
          </form>

          {/* Контент */}
          {loading.value ? (
            <div class="loading-state" role="status" aria-live="polite">
              <div class="spinner" aria-hidden="true"></div>
              <p>Загрузка мероприятий...</p>
            </div>
          ) : error.value ? (
            <div class="error-state" role="alert">
              <p class="error-text">{error.value}</p>
              <button type="button" class="btn btn--primary" onClick={loadEvents}>
                Повторить
              </button>
            </div>
          ) : events.value.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">🎉</div>
              <h2>Нет мероприятий</h2>
              <p>Создайте первое мероприятие</p>
              <a href="/events/create" class="btn btn--primary">
                Создать мероприятие
              </a>
            </div>
          ) : (
            <>
              <div class="results-info" aria-live="polite">
                Найдено: {totalCount.value} мероприятий
              </div>

              <ul class="events-grid" aria-labelledby="events-page-title">
                {events.value.map((event) => {
                  const cardTitleId = `event-card-${event.id}-title`
                  return (
                    <li>
                      <article class="event-card card" aria-labelledby={cardTitleId}>
                        <div class="event-header">
                          <div class="event-theme-icon" aria-hidden="true">
                            {EVENT_THEME_ICONS[event.theme] || '📌'}
                          </div>
                          <span
                            class="status-badge"
                            style={{ backgroundColor: getStatusColor(event.status) }}
                          >
                            <span class="sr-only">Статус: </span>
                            {getStatusLabel(event.status)}
                          </span>
                        </div>

                        <h3 id={cardTitleId} class="event-title">{event.title}</h3>

                        <dl class="event-body">
                          <div class="event-detail">
                            <dt class="detail-label">Дата:</dt>
                            <dd class="detail-value">{formatDate(event.date)}</dd>
                          </div>
                          {event.start_time && (
                            <div class="event-detail">
                              <dt class="detail-label">Время:</dt>
                              <dd class="detail-value">
                                {event.start_time} — {event.end_time}
                              </dd>
                            </div>
                          )}
                          <div class="event-detail">
                            <dt class="detail-label">Тематика:</dt>
                            <dd class="detail-value">{event.theme_display}</dd>
                          </div>
                          <div class="event-detail">
                            <dt class="detail-label">Гостей:</dt>
                            <dd class="detail-value">{event.expected_guests}</dd>
                          </div>
                          {event.duration_hours && (
                            <div class="event-detail">
                              <dt class="detail-label">Длительность:</dt>
                              <dd class="detail-value">{event.duration_hours} ч</dd>
                            </div>
                          )}
                        </dl>

                        {event.venues && event.venues.length > 0 && (
                          <div class="event-venues">
                            <div class="venues-label" id={`event-${event.id}-venues`}>Площадки:</div>
                            <ul aria-labelledby={`event-${event.id}-venues`}>
                              {event.venues.map((venue) => (
                                <li class="venue-item">{venue.name}, {venue.city}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div class="event-footer">
                          <div class="event-actions">
                            <a
                              href={`/dashboard/events/${event.id}`}
                              class="btn btn--sm btn--outline"
                              aria-label={`Подробнее о мероприятии ${event.title}`}
                            >
                              Подробнее
                            </a>
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>

              {/* Пагинация */}
              {totalPages.value > 1 && (
                <nav class="pagination" aria-label="Пагинация мероприятий">
                  <button
                    type="button"
                    class="btn btn--sm btn--outline"
                    disabled={currentPage.value === 1}
                    onClick={() => handlePageChange(currentPage.value - 1)}
                    aria-label="Предыдущая страница"
                  >
                    <span aria-hidden="true">←</span> Назад
                  </button>
                  <span class="pagination-info" aria-current="page">
                    Страница {currentPage.value} из {totalPages.value}
                  </span>
                  <button
                    type="button"
                    class="btn btn--sm btn--outline"
                    disabled={currentPage.value === totalPages.value}
                    onClick={() => handlePageChange(currentPage.value + 1)}
                    aria-label="Следующая страница"
                  >
                    Вперед <span aria-hidden="true">→</span>
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
})
