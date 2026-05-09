import { defineComponent, onMounted, ref, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS, HIRE_STATUS, HIRE_STATUS_COLORS } from '~/utils/constants'
import type { HireListInfo, HireStatus } from '~/utils/types'
import UiButton from '~/components/ui/Button'
import UiSelect from '~/components/ui/Select'

definePageMeta({
  middleware: 'auth',
})

export default defineComponent({
  name: 'DashboardHiresPage',
  setup() {
    const $api = useApi()
    const loading = ref(true)
    const error = ref<string | null>(null)
    const hires = ref<HireListInfo[]>([])
    const totalCount = ref(0)

    // Фильтры
    const statusFilter = ref<HireStatus | ''>('')
    const ordering = ref('-created_at')

    // Пагинация
    const currentPage = ref(1)
    const pageSize = ref(12)

    const statusOptions = computed(() => [
      { value: '', label: 'Все статусы' },
      ...Object.entries(HIRE_STATUS).map(([value, label]) => ({ value, label })),
    ])

    const orderingOptions = computed(() => [
      { value: '-created_at', label: 'Сначала новые' },
      { value: 'created_at', label: 'Сначала старые' },
      { value: '-start_datetime', label: 'По дате начала (убыв.)' },
      { value: 'start_datetime', label: 'По дате начала (возр.)' },
      { value: '-total_price', label: 'По цене (убыв.)' },
      { value: 'total_price', label: 'По цене (возр.)' },
    ])

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
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const loadHires = async () => {
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

        const response = await $api.get<HireListInfo[] | { results: HireListInfo[]; count: number }>(
          API_ENDPOINTS.hires.my,
          { params }
        )

        if (Array.isArray(response)) {
          hires.value = response
          totalCount.value = response.length
        } else {
          hires.value = response.results ?? []
          totalCount.value = response.count ?? 0
        }
      } catch (err: any) {
        error.value = err.message || 'Ошибка загрузки данных'
        console.error('Error loading hires:', err)
      } finally {
        loading.value = false
      }
    }

    const handleFilterChange = () => {
      currentPage.value = 1
      loadHires()
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      loadHires()
    }

    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

    const getStatusColor = (status: HireStatus): string => {
      const colors: Record<string, string> = {
        pending: '#f59e0b',
        confirmed: '#3b82f6',
        cancelled: '#ef4444',
        completed: '#10b981',
      }
      return colors[status] || '#6b7280'
    }

    const getStatusLabel = (status: HireStatus): string => {
      return HIRE_STATUS[status] || status
    }

    onMounted(() => {
      loadHires()
    })

    return () => (
      <div class="dashboard-hires-page">
        <div class="container">
          <header class="page-header">
            <div>
              <h1 id="hires-page-title" class="page-title">Мои наймы специалистов</h1>
              <p class="page-subtitle">Управление наймами специалистов</p>
            </div>
          </header>

          {/* Фильтры */}
          <form
            class="filters-bar"
            role="search"
            aria-label="Фильтры наймов"
            onSubmit={(e) => e.preventDefault()}
          >
            <div class="filter-item">
              <UiSelect
                id="hires-filter-status"
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
                id="hires-filter-ordering"
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
              <p>Загрузка наймов...</p>
            </div>
          ) : error.value ? (
            <div class="error-state" role="alert">
              <p class="error-text">{error.value}</p>
              <button type="button" class="btn btn--primary" onClick={loadHires}>
                Повторить
              </button>
            </div>
          ) : hires.value.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">👥</div>
              <h2>Нет наймов специалистов</h2>
              <p>У вас пока нет нанятых специалистов</p>
              <a href="/specialists" class="btn btn--primary">
                Найти специалиста
              </a>
            </div>
          ) : (
            <>
              <div class="results-info" aria-live="polite">
                Найдено: {totalCount.value} наймов
              </div>

              <ul class="hires-grid" aria-labelledby="hires-page-title">
                {hires.value.map((hire) => {
                  const cardTitleId = `hire-${hire.id}-title`
                  return (
                    <li>
                      <article class="hire-card card" aria-labelledby={cardTitleId}>
                        <div class="hire-header">
                          <div>
                            <h3 id={cardTitleId} class="hire-title">{hire.specialist_name}</h3>
                            <div class="hire-specialty">{hire.specialist_specialty}</div>
                          </div>
                          <span
                            class="status-badge"
                            style={{ backgroundColor: getStatusColor(hire.status) }}
                          >
                            <span class="sr-only">Статус: </span>
                            {getStatusLabel(hire.status)}
                          </span>
                        </div>

                        <dl class="hire-body">
                          <div class="hire-detail">
                            <dt class="detail-label">Мероприятие:</dt>
                            <dd class="detail-value">{hire.event_title}</dd>
                          </div>
                          <div class="hire-detail">
                            <dt class="detail-label">Дата:</dt>
                            <dd class="detail-value">
                              {formatDate(hire.start_datetime)} — {formatDate(hire.end_datetime)}
                            </dd>
                          </div>
                          <div class="hire-detail">
                            <dt class="detail-label">Длительность:</dt>
                            <dd class="detail-value">{hire.duration_hours} ч</dd>
                          </div>
                        </dl>

                        <div class="hire-footer">
                          <div class="hire-price" aria-label={`Сумма: ${formatCurrency(hire.total_price)}`}>
                            {formatCurrency(hire.total_price)}
                          </div>
                          <div class="hire-actions">
                            <a
                              href={`/dashboard/hires/${hire.id}`}
                              class="btn btn--sm btn--outline"
                              aria-label={`Подробнее о найме специалиста ${hire.specialist_name}`}
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
                <nav class="pagination" aria-label="Пагинация наймов">
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
