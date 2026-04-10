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
          <div class="page-header">
            <div>
              <h1 class="page-title">Мои мероприятия</h1>
              <p class="page-subtitle">Управление мероприятиями</p>
            </div>
            <a href="/events/create" class="btn btn--primary">
              + Создать мероприятие
            </a>
          </div>

          {/* Фильтры */}
          <div class="filters-bar">
            <div class="filter-item">
              <UiSelect
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
                label="Сортировка"
                modelValue={ordering.value}
                onUpdate:modelValue={(val: any) => {
                  ordering.value = val
                  handleFilterChange()
                }}
                options={orderingOptions.value}
              />
            </div>
          </div>

          {/* Контент */}
          {loading.value ? (
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Загрузка мероприятий...</p>
            </div>
          ) : error.value ? (
            <div class="error-state">
              <p class="error-text">{error.value}</p>
              <button class="btn btn--primary" onClick={loadEvents}>
                Повторить
              </button>
            </div>
          ) : events.value.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon">🎉</div>
              <h3>Нет мероприятий</h3>
              <p>Создайте первое мероприятие</p>
              <a href="/events/create" class="btn btn--primary">
                Создать мероприятие
              </a>
            </div>
          ) : (
            <>
              <div class="results-info">
                Найдено: {totalCount.value} мероприятий
              </div>

              <div class="events-grid">
                {events.value.map((event) => (
                  <div class="event-card card">
                    <div class="event-header">
                      <div class="event-theme-icon">
                        {EVENT_THEME_ICONS[event.theme] || '📌'}
                      </div>
                      <span
                        class="status-badge"
                        style={{ backgroundColor: getStatusColor(event.status) }}
                      >
                        {getStatusLabel(event.status)}
                      </span>
                    </div>

                    <h3 class="event-title">{event.title}</h3>

                    <div class="event-body">
                      <div class="event-detail">
                        <span class="detail-label">Дата:</span>
                        <span class="detail-value">{formatDate(event.date)}</span>
                      </div>
                      {event.start_time && (
                        <div class="event-detail">
                          <span class="detail-label">Время:</span>
                          <span class="detail-value">
                            {event.start_time} — {event.end_time}
                          </span>
                        </div>
                      )}
                      <div class="event-detail">
                        <span class="detail-label">Тематика:</span>
                        <span class="detail-value">{event.theme_display}</span>
                      </div>
                      <div class="event-detail">
                        <span class="detail-label">Гостей:</span>
                        <span class="detail-value">{event.expected_guests}</span>
                      </div>
                      {event.duration_hours && (
                        <div class="event-detail">
                          <span class="detail-label">Длительность:</span>
                          <span class="detail-value">{event.duration_hours} ч</span>
                        </div>
                      )}
                    </div>

                    {event.venues && event.venues.length > 0 && (
                      <div class="event-venues">
                        <div class="venues-label">Площадки:</div>
                        {event.venues.map((venue) => (
                          <div class="venue-item">{venue.name}, {venue.city}</div>
                        ))}
                      </div>
                    )}

                    <div class="event-footer">
                      <div class="event-actions">
                        <a href={`/dashboard/events/${event.id}`} class="btn btn--sm btn--outline">
                          Подробнее
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Пагинация */}
              {totalPages.value > 1 && (
                <div class="pagination">
                  <button
                    class="btn btn--sm btn--outline"
                    disabled={currentPage.value === 1}
                    onClick={() => handlePageChange(currentPage.value - 1)}
                  >
                    ← Назад
                  </button>
                  <span class="pagination-info">
                    Страница {currentPage.value} из {totalPages.value}
                  </span>
                  <button
                    class="btn btn--sm btn--outline"
                    disabled={currentPage.value === totalPages.value}
                    onClick={() => handlePageChange(currentPage.value + 1)}
                  >
                    Вперед →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
})
