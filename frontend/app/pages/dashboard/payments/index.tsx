import { defineComponent, onMounted, ref, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS, PAYMENT_STATUS, PAYMENT_STATUS_COLORS } from '~/utils/constants'
import type { PaymentListInfo, PaymentStatus } from '~/utils/types'
import UiButton from '~/components/ui/Button'
import UiSelect from '~/components/ui/Select'

definePageMeta({
  middleware: 'auth',
})

export default defineComponent({
  name: 'DashboardPaymentsPage',
  setup() {
    const $api = useApi()
    const loading = ref(true)
    const error = ref<string | null>(null)
    const payments = ref<PaymentListInfo[]>([])
    const totalCount = ref(0)
    const totalAmount = ref(0)

    // Фильтры
    const statusFilter = ref<PaymentStatus | ''>('')
    const ordering = ref('-created_at')

    // Пагинация
    const currentPage = ref(1)
    const pageSize = ref(12)

    const statusOptions = computed(() => [
      { value: '', label: 'Все статусы' },
      ...Object.entries(PAYMENT_STATUS).map(([value, label]) => ({ value, label })),
    ])

    const orderingOptions = computed(() => [
      { value: '-created_at', label: 'Сначала новые' },
      { value: 'created_at', label: 'Сначала старые' },
      { value: '-amount', label: 'По сумме (убыв.)' },
      { value: 'amount', label: 'По сумме (возр.)' },
      { value: '-paid_at', label: 'По дате оплаты (убыв.)' },
      { value: 'paid_at', label: 'По дате оплаты (возр.)' },
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

    const loadPayments = async () => {
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

        const response = await $api.get<PaymentListInfo[] | { results: PaymentListInfo[]; count: number }>(
          API_ENDPOINTS.payments.my,
          { params }
        )

        if (Array.isArray(response)) {
          payments.value = response
          totalCount.value = response.length
        } else {
          payments.value = response.results ?? []
          totalCount.value = response.count ?? 0
        }

        // Считаем общую сумму
        totalAmount.value = payments.value.reduce((sum, p) => sum + p.amount, 0)
      } catch (err: any) {
        error.value = err.message || 'Ошибка загрузки данных'
        console.error('Error loading payments:', err)
      } finally {
        loading.value = false
      }
    }

    const handleFilterChange = () => {
      currentPage.value = 1
      loadPayments()
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      loadPayments()
    }

    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

    const getStatusColor = (status: PaymentStatus): string => {
      const colors: Record<string, string> = {
        pending: '#f59e0b',
        succeeded: '#10b981',
        failed: '#ef4444',
        cancelled: '#6b7280',
        refunded: '#64748b',
      }
      return colors[status] || '#6b7280'
    }

    const getStatusLabel = (status: PaymentStatus): string => {
      return PAYMENT_STATUS[status] || status
    }

    const getTargetLabel = (targetType: string | null): { icon: string; label: string } => {
      if (targetType === 'booking') return { icon: '📅', label: 'Бронирование' }
      if (targetType === 'hire') return { icon: '👥', label: 'Найм' }
      return { icon: '', label: '—' }
    }

    onMounted(() => {
      loadPayments()
    })

    return () => (
      <div class="dashboard-payments-page">
        <div class="container">
          <header class="page-header">
            <div>
              <h1 id="payments-page-title" class="page-title">Мои платежи</h1>
              <p class="page-subtitle">История платежей и транзакций</p>
            </div>
          </header>

          {/* Сводка */}
          {!loading.value && payments.value.length > 0 && (
            <dl class="payments-summary" aria-label="Сводка по платежам">
              <div class="summary-item">
                <dt class="summary-label">Всего платежей</dt>
                <dd class="summary-value">{totalCount.value}</dd>
              </div>
              <div class="summary-item">
                <dt class="summary-label">Общая сумма</dt>
                <dd class="summary-value summary-value--accent">
                  {formatCurrency(totalAmount.value)}
                </dd>
              </div>
            </dl>
          )}

          {/* Фильтры */}
          <form
            class="filters-bar"
            role="search"
            aria-label="Фильтры платежей"
            onSubmit={(e) => e.preventDefault()}
          >
            <div class="filter-item">
              <UiSelect
                id="payments-filter-status"
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
                id="payments-filter-ordering"
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
              <p>Загрузка платежей...</p>
            </div>
          ) : error.value ? (
            <div class="error-state" role="alert">
              <p class="error-text">{error.value}</p>
              <button type="button" class="btn btn--primary" onClick={loadPayments}>
                Повторить
              </button>
            </div>
          ) : payments.value.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">💳</div>
              <h2>Нет платежей</h2>
              <p>У вас пока нет платежей</p>
            </div>
          ) : (
            <>
              <div class="results-info" aria-live="polite">
                Найдено: {totalCount.value} платежей
              </div>

              <div class="table-container">
                <table class="data-table">
                  <caption class="sr-only">Список платежей</caption>
                  <thead>
                    <tr>
                      <th scope="col">Тип</th>
                      <th scope="col">Сумма</th>
                      <th scope="col">Статус</th>
                      <th scope="col">Дата создания</th>
                      <th scope="col">Дата оплаты</th>
                      <th scope="col">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.value.map((payment) => {
                      const target = getTargetLabel(payment.target_type)
                      return (
                        <tr>
                          <td>
                            <span class="type-badge">
                              {target.icon && <span aria-hidden="true">{target.icon} </span>}
                              {target.label}
                            </span>
                          </td>
                          <td class="cell-price">{formatCurrency(payment.amount)}</td>
                          <td>
                            <span
                              class="status-badge"
                              style={{ backgroundColor: getStatusColor(payment.status) }}
                            >
                              <span class="sr-only">Статус: </span>
                              {getStatusLabel(payment.status)}
                            </span>
                          </td>
                          <td>{formatDate(payment.created_at)}</td>
                          <td>{payment.paid_at ? formatDate(payment.paid_at) : '—'}</td>
                          <td>
                            <a
                              href={`/dashboard/payments/${payment.id}`}
                              class="btn btn--sm btn--outline"
                              aria-label={`Подробнее о платеже от ${formatDate(payment.created_at)}`}
                            >
                              Подробнее
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Пагинация */}
              {totalPages.value > 1 && (
                <nav class="pagination" aria-label="Пагинация платежей">
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
