import { defineComponent, onMounted, ref, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS, VENUE_STATUS, VENUE_STATUS_COLORS } from '~/utils/constants'
import type { Venue, VenueStatus } from '~/utils/types'
import UiButton from '~/components/ui/Button'
import UiSelect from '~/components/ui/Select'

definePageMeta({
  middleware: 'auth',
})

export default defineComponent({
  name: 'DashboardVenuesPage',
  setup() {
    const $api = useApi()
    const loading = ref(true)
    const error = ref<string | null>(null)
    const venues = ref<Venue[]>([])
    const totalCount = ref(0)

    // Фильтры
    const statusFilter = ref<VenueStatus | ''>('')
    const ordering = ref('-created_at')

    // Пагинация
    const currentPage = ref(1)
    const pageSize = ref(12)

    const statusOptions = computed(() => [
      { value: '', label: 'Все статусы' },
      ...Object.entries(VENUE_STATUS).map(([value, label]) => ({ value, label })),
    ])

    const orderingOptions = computed(() => [
      { value: '-created_at', label: 'Сначала новые' },
      { value: 'created_at', label: 'Сначала старые' },
      { value: '-price_per_hour', label: 'По цене за час (убыв.)' },
      { value: 'price_per_hour', label: 'По цене за час (возр.)' },
      { value: '-capacity_max', label: 'По вместимости (убыв.)' },
      { value: 'capacity_max', label: 'По вместимости (возр.)' },
    ])

    const formatCurrency = (amount: number | null): string => {
      if (!amount) return 'Не указана'
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
      }).format(amount)
    }

    const formatNumber = (num: number | null): string => {
      if (!num) return '—'
      return num.toString()
    }

    const loadVenues = async () => {
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
        if (ordering.value) {
          params.ordering = ordering.value
        }

        const response = await $api.get<{ results: Venue[]; count: number }>(
          API_ENDPOINTS.venues.my,
          { params }
        )

        venues.value = response.results || []
        totalCount.value = response.count || 0
      } catch (err: any) {
        error.value = err.message || 'Ошибка загрузки данных'
        console.error('Error loading venues:', err)
      } finally {
        loading.value = false
      }
    }

    const handleFilterChange = () => {
      currentPage.value = 1
      loadVenues()
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      loadVenues()
    }

    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

    const getStatusColor = (status: VenueStatus): string => {
      const colors: Record<string, string> = {
        draft: '#6b7280',
        published: '#10b981',
        archived: '#64748b',
        moderation: '#f59e0b',
      }
      return colors[status] || '#6b7280'
    }

    const getStatusLabel = (status: VenueStatus): string => {
      return VENUE_STATUS[status] || status
    }

    onMounted(() => {
      loadVenues()
    })

    return () => (
      <div class="dashboard-venues-page">
        <div class="container">
          <header class="page-header">
            <div>
              <h1 id="venues-page-title" class="page-title">Мои площадки</h1>
              <p class="page-subtitle">Управление площадками</p>
            </div>
            <a href="/venues/create" class="btn btn--primary">
              <span aria-hidden="true">+</span> Добавить площадку
            </a>
          </header>

          {/* Фильтры */}
          <form
            class="filters-bar"
            role="search"
            aria-label="Фильтры площадок"
            onSubmit={(e) => e.preventDefault()}
          >
            <div class="filter-item">
              <UiSelect
                id="venues-filter-status"
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
                id="venues-filter-ordering"
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
              <p>Загрузка площадок...</p>
            </div>
          ) : error.value ? (
            <div class="error-state" role="alert">
              <p class="error-text">{error.value}</p>
              <button type="button" class="btn btn--primary" onClick={loadVenues}>
                Повторить
              </button>
            </div>
          ) : venues.value.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">🏛️</div>
              <h2>Нет площадок</h2>
              <p>Добавьте свою первую площадку</p>
              <a href="/venues/create" class="btn btn--primary">
                Добавить площадку
              </a>
            </div>
          ) : (
            <>
              <div class="results-info" aria-live="polite">
                Найдено: {totalCount.value} площадок
              </div>

              <ul class="venues-grid" aria-labelledby="venues-page-title">
                {venues.value.map((venue) => {
                  const cardTitleId = `venue-mng-${venue.id}-title`
                  return (
                    <li>
                      <article class="venue-card card" aria-labelledby={cardTitleId}>
                        {venue.main_photo ? (
                          <div class="venue-photo">
                            <img
                              src={venue.main_photo}
                              alt={`Фотография площадки «${venue.name}»`}
                            />
                          </div>
                        ) : (
                          <div
                            class="venue-photo venue-photo--placeholder"
                            role="img"
                            aria-label="Фото площадки отсутствует"
                          >
                            <div class="photo-placeholder-icon" aria-hidden="true">🏛️</div>
                          </div>
                        )}

                        <div class="venue-info">
                          <div class="venue-header">
                            <h3 id={cardTitleId} class="venue-title">{venue.name}</h3>
                            <span
                              class="status-badge"
                              style={{ backgroundColor: getStatusColor(venue.status) }}
                            >
                              <span class="sr-only">Статус: </span>
                              {getStatusLabel(venue.status)}
                            </span>
                          </div>

                          <dl class="venue-details">
                            <div class="venue-detail">
                              <dt class="detail-label">Город:</dt>
                              <dd class="detail-value">{venue.city}</dd>
                            </div>
                            <div class="venue-detail">
                              <dt class="detail-label">Адрес:</dt>
                              <dd class="detail-value">{venue.address}</dd>
                            </div>
                            <div class="venue-detail">
                              <dt class="detail-label">Вместимость:</dt>
                              <dd class="detail-value">
                                {venue.capacity_min && venue.capacity_max
                                  ? `${venue.capacity_min}–${venue.capacity_max} чел.`
                                  : formatNumber(venue.capacity_max) + ' чел.'}
                              </dd>
                            </div>
                            <div class="venue-detail">
                              <dt class="detail-label">Цена за час:</dt>
                              <dd class="detail-value">
                                {formatCurrency(venue.price_per_hour)}
                              </dd>
                            </div>
                            <div class="venue-detail">
                              <dt class="detail-label">Цена за день:</dt>
                              <dd class="detail-value">
                                {formatCurrency(venue.price_per_day)}
                              </dd>
                            </div>
                          </dl>

                          {venue.is_verified && (
                            <div class="venue-verified">
                              <span aria-hidden="true">✓</span> Верифицирована
                            </div>
                          )}
                        </div>

                        <div class="venue-footer">
                          <div class="venue-actions">
                            <a
                              href={`/dashboard/venues/${venue.id}`}
                              class="btn btn--sm btn--outline"
                              aria-label={`Управление площадкой «${venue.name}»`}
                            >
                              Подробнее
                            </a>
                            <a
                              href={`/venues/${venue.slug}`}
                              class="btn btn--sm btn--primary"
                              aria-label={`Открыть страницу площадки «${venue.name}»`}
                            >
                              Просмотр
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
                <nav class="pagination" aria-label="Пагинация площадок">
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
