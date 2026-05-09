import { defineComponent, onMounted, ref, reactive, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import {
  API_ENDPOINTS,
  EVENT_STATUS,
  EVENT_THEMES,
  EVENT_THEME_ICONS,
} from '~/utils/constants'
import type { Event, EventStatus, EventTheme } from '~/utils/types'
import UiButton from '~/components/ui/Button'
import UiSelect from '~/components/ui/Select'
import UiInput from '~/components/ui/Input'
import UiAlert from '~/components/ui/Alert'
import UiDialog from '~/components/ui/Dialog'
import { useUserStore } from '~/stores/user'

definePageMeta({ middleware: 'auth' })

// ─── Форма создания мероприятия ───────────────────────────────────────────────

interface EventForm {
  title: string
  date: string
  start_time: string
  end_time: string
  theme: EventTheme | ''
  short_description: string
  description: string
  expected_guests: number
  status: 'draft' | 'planned'
}

const EMPTY_FORM = (): EventForm => ({
  title: '',
  date: '',
  start_time: '',
  end_time: '',
  theme: 'other',
  short_description: '',
  description: '',
  expected_guests: 20,
  status: 'draft',
})

const today = () => new Date().toISOString().split('T')[0]

// ─── Компонент страницы ───────────────────────────────────────────────────────

export default defineComponent({
  name: 'DashboardEventsPage',
  setup() {
    const $api = useApi()
    const userStore = useUserStore()

    // ── Список мероприятий ──
    const loading = ref(true)
    const error = ref<string | null>(null)
    const events = ref<Event[]>([])
    const totalCount = ref(0)
    const statusFilter = ref<EventStatus | ''>('')
    const themeFilter = ref<string>('')
    const ordering = ref('-created_at')
    const currentPage = ref(1)
    const pageSize = ref(12)

    // ── Диалог создания ──
    const dialogOpen = ref(false)
    const form = reactive<EventForm>(EMPTY_FORM())
    const formErrors = ref<Record<string, string>>({})
    const submitting = ref(false)
    const submitError = ref('')

    // ── Computed ──
    const isRenter = computed(() => userStore.user?.role === 'renter')

    const statusOptions = computed(() => [
      { value: '', label: 'Все статусы' },
      ...Object.entries(EVENT_STATUS).map(([v, l]) => ({ value: v, label: l })),
    ])

    const themeOptions = computed(() => [
      { value: '', label: 'Все тематики' },
      ...Object.entries(EVENT_THEMES).map(([v, l]) => ({ value: v, label: l })),
    ])

    const orderingOptions = computed(() => [
      { value: '-created_at', label: 'Сначала новые' },
      { value: 'created_at', label: 'Сначала старые' },
      { value: '-date', label: 'По дате (убыв.)' },
      { value: 'date', label: 'По дате (возр.)' },
      { value: '-expected_guests', label: 'По гостям (убыв.)' },
      { value: 'expected_guests', label: 'По гостям (возр.)' },
    ])

    const createThemeOptions = computed(() =>
      Object.entries(EVENT_THEMES).map(([v, l]) => ({
        value: v,
        label: `${EVENT_THEME_ICONS[v as EventTheme] ?? '📌'} ${l}`,
      })),
    )

    const createStatusOptions = [
      { value: 'draft', label: 'Черновик — сохранить, не публиковать' },
      { value: 'planned', label: 'Запланировано — опубликовать сразу' },
    ]

    const shortDescLen = computed(() => form.short_description.length)
    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

    // ── Список: загрузка ──
    const loadEvents = async () => {
      loading.value = true
      error.value = null
      try {
        const params: Record<string, any> = {
          page: currentPage.value,
          page_size: pageSize.value,
        }
        if (statusFilter.value) params.status = statusFilter.value
        if (themeFilter.value) params.theme = themeFilter.value
        if (ordering.value) params.ordering = ordering.value

        const res = await $api.get<Event[] | { results: Event[]; count: number }>(
          API_ENDPOINTS.events.my,
          { params },
        )
        if (Array.isArray(res)) {
          events.value = res
          totalCount.value = res.length
        } else {
          events.value = res.results ?? []
          totalCount.value = res.count ?? 0
        }
      } catch (e: any) {
        error.value = e.message || 'Ошибка загрузки данных'
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

    // ── Диалог: создание ──
    const openDialog = () => {
      Object.assign(form, EMPTY_FORM())
      formErrors.value = {}
      submitError.value = ''
      dialogOpen.value = true
    }

    const closeDialog = () => {
      dialogOpen.value = false
    }

    const validate = (): boolean => {
      const errs: Record<string, string> = {}

      if (!form.title.trim()) errs.title = 'Название обязательно'
      else if (form.title.length > 200) errs.title = 'Не более 200 символов'

      if (!form.date) errs.date = 'Дата обязательна'

      if (form.start_time && form.end_time && form.start_time >= form.end_time)
        errs.end_time = 'Время окончания должно быть позже времени начала'

      if (!form.theme) errs.theme = 'Выберите тематику'

      if (!form.expected_guests || form.expected_guests < 1)
        errs.expected_guests = 'Не менее 1 гостя'

      if (form.short_description.length > 300)
        errs.short_description = 'Не более 300 символов'

      formErrors.value = errs
      return Object.keys(errs).length === 0
    }

    const submitForm = async () => {
      if (!validate()) return

      submitting.value = true
      submitError.value = ''

      try {
        const payload: Record<string, any> = {
          title: form.title.trim(),
          date: form.date,
          theme: form.theme,
          expected_guests: Number(form.expected_guests),
          status: form.status,
        }
        if (form.start_time) payload.start_time = form.start_time
        if (form.end_time) payload.end_time = form.end_time
        if (form.short_description.trim()) payload.short_description = form.short_description.trim()
        if (form.description.trim()) payload.description = form.description.trim()

        await $api.post(API_ENDPOINTS.events.list, payload)

        closeDialog()
        currentPage.value = 1
        loadEvents()
      } catch (e: any) {
        // Разбираем серверные ошибки валидации
        if (e.data && typeof e.data === 'object' && !e.data.detail) {
          const serverErrs: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(e.data)) {
            serverErrs[field] = Array.isArray(msgs) ? (msgs as string[])[0] : String(msgs)
          }
          formErrors.value = { ...formErrors.value, ...serverErrs }
        } else {
          submitError.value = e.data?.detail || e.message || 'Ошибка при создании мероприятия'
        }
      } finally {
        submitting.value = false
      }
    }

    // ── Хелперы отображения ──
    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const getStatusColor = (s: EventStatus): string =>
      ({
        draft:     '#6b7280', // серый
        planned:   '#d97706', // жёлтый
        active:    '#2563eb', // синий
        ongoing:   '#16a34a', // зелёный
        completed: '#16a34a', // зелёный
        cancelled: '#dc2626', // красный
      }[s] ?? '#6b7280')

    onMounted(loadEvents)

    // ─── Render ────────────────────────────────────────────────────────────────
    return () => (
      <div class="dashboard-events-page">
        <div class="container">

          {/* Заголовок */}
          <header class="page-header">
            <div>
              <h1 id="events-page-title" class="page-title">Мои мероприятия</h1>
              <p class="page-subtitle">Управление мероприятиями</p>
            </div>
            {isRenter.value && (
              <UiButton variant="primary" onClick={openDialog}>
                <span aria-hidden="true">+</span> Создать мероприятие
              </UiButton>
            )}
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
                onUpdate:modelValue={(v: any) => { statusFilter.value = v; handleFilterChange() }}
                options={statusOptions.value}
              />
            </div>
            <div class="filter-item">
              <UiSelect
                id="events-filter-theme"
                label="Тематика"
                modelValue={themeFilter.value}
                onUpdate:modelValue={(v: any) => { themeFilter.value = v; handleFilterChange() }}
                options={themeOptions.value}
              />
            </div>
            <div class="filter-item">
              <UiSelect
                id="events-filter-ordering"
                label="Сортировка"
                modelValue={ordering.value}
                onUpdate:modelValue={(v: any) => { ordering.value = v; handleFilterChange() }}
                options={orderingOptions.value}
              />
            </div>
          </form>

          {/* Список */}
          {loading.value ? (
            <div class="catalog-loading" role="status" aria-live="polite">
              <div class="spinner" aria-hidden="true" />
              <p>Загрузка мероприятий...</p>
            </div>
          ) : error.value ? (
            <div class="empty-state" role="alert">
              <p class="empty-state-title">{error.value}</p>
              <UiButton variant="primary" onClick={loadEvents}>Повторить</UiButton>
            </div>
          ) : events.value.length === 0 ? (
            <div class="empty-state">
              <div class="empty-state-icon" aria-hidden="true">🎉</div>
              <p class="empty-state-title">Нет мероприятий</p>
              <p>Создайте первое мероприятие</p>
              {isRenter.value && (
                <UiButton variant="primary" onClick={openDialog}>
                  Создать мероприятие
                </UiButton>
              )}
            </div>
          ) : (
            <>
              <div class="results-info" aria-live="polite">
                Найдено: {totalCount.value} мероприятий
              </div>

              <ul class="events-grid" aria-labelledby="events-page-title">
                {events.value.map((ev) => {
                  const titleId = `ev-${ev.id}-title`
                  return (
                    <li key={ev.id}>
                      <article class="event-card card" aria-labelledby={titleId}>
                        <div class="event-header">
                          <div class="event-theme-icon" aria-hidden="true">
                            {EVENT_THEME_ICONS[ev.theme] ?? '📌'}
                          </div>
                          <span
                            class="status-badge"
                            style={{ backgroundColor: getStatusColor(ev.status) }}
                          >
                            <span class="sr-only">Статус: </span>
                            {EVENT_STATUS[ev.status] ?? ev.status}
                          </span>
                        </div>

                        <h3 id={titleId} class="event-title">{ev.title}</h3>

                        <dl class="event-body">
                          <div class="event-detail">
                            <dt class="detail-label">Дата:</dt>
                            <dd class="detail-value">{formatDate(ev.date)}</dd>
                          </div>
                          {ev.start_time && (
                            <div class="event-detail">
                              <dt class="detail-label">Время:</dt>
                              <dd class="detail-value">{ev.start_time} — {ev.end_time}</dd>
                            </div>
                          )}
                          <div class="event-detail">
                            <dt class="detail-label">Тематика:</dt>
                            <dd class="detail-value">{ev.theme_display ?? ev.theme}</dd>
                          </div>
                          <div class="event-detail">
                            <dt class="detail-label">Гостей:</dt>
                            <dd class="detail-value">{ev.expected_guests}</dd>
                          </div>
                        </dl>

                        <div class="event-footer">
                          <a
                            href={`/dashboard/events/${ev.id}`}
                            class="btn btn--sm btn--outline"
                            aria-label={`Подробнее о мероприятии ${ev.title}`}
                          >
                            Подробнее
                          </a>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>

              {totalPages.value > 1 && (
                <nav class="pagination" aria-label="Страницы мероприятий">
                  <button
                    type="button"
                    class="btn btn--sm btn--outline"
                    disabled={currentPage.value === 1}
                    onClick={() => handlePageChange(currentPage.value - 1)}
                    aria-label="Предыдущая страница"
                  >
                    ← Назад
                  </button>
                  <span class="pagination-info" aria-live="polite">
                    Страница {currentPage.value} из {totalPages.value}
                  </span>
                  <button
                    type="button"
                    class="btn btn--sm btn--outline"
                    disabled={currentPage.value === totalPages.value}
                    onClick={() => handlePageChange(currentPage.value + 1)}
                    aria-label="Следующая страница"
                  >
                    Вперёд →
                  </button>
                </nav>
              )}
            </>
          )}
        </div>

        {/* ── Диалог создания мероприятия ── */}
        <UiDialog
          open={dialogOpen.value}
          title="Новое мероприятие"
          size="lg"
          onClose={closeDialog}
        >
          {{
            default: () => (
              <form
                id="event-create-form"
                class="ecf"
                onSubmit={(e) => { e.preventDefault(); submitForm() }}
                novalidate
                aria-label="Форма создания мероприятия"
              >
                {submitError.value && (
                  <div class="ecf__alert">
                    <UiAlert variant="error" title="Ошибка">
                      {submitError.value}
                    </UiAlert>
                  </div>
                )}

                {/* Название */}
                <UiInput
                  id="ecf-title"
                  label="Название мероприятия"
                  modelValue={form.title}
                  onUpdate:modelValue={(v: string) => { form.title = v }}
                  placeholder="Например: День рождения компании"
                  required
                  error={formErrors.value.title}
                />

                {/* Тематика */}
                <UiSelect
                  id="ecf-theme"
                  label="Тематика"
                  modelValue={form.theme}
                  onUpdate:modelValue={(v: any) => { form.theme = v }}
                  options={createThemeOptions.value}
                  required
                  error={formErrors.value.theme}
                />

                {/* Дата */}
                <div class="ecf__row">
                  <div class="input-wrapper">
                    <label class="input-label" for="ecf-date">
                      Дата проведения
                      <span class="input-required" aria-hidden="true">*</span>
                      <span class="sr-only"> (обязательно)</span>
                    </label>
                    <input
                      id="ecf-date"
                      type="date"
                      class={['input', formErrors.value.date && 'input--error']}
                      value={form.date}
                      min={today()}
                      required
                      aria-invalid={formErrors.value.date ? 'true' : undefined}
                      aria-describedby={formErrors.value.date ? 'ecf-date-error' : undefined}
                      onInput={(e) => { form.date = (e.target as HTMLInputElement).value }}
                    />
                    {formErrors.value.date && (
                      <p id="ecf-date-error" class="input-error" role="alert">
                        {formErrors.value.date}
                      </p>
                    )}
                  </div>

                  <div class="input-wrapper">
                    <label class="input-label" for="ecf-start">Время начала</label>
                    <input
                      id="ecf-start"
                      type="time"
                      class="input"
                      value={form.start_time}
                      onInput={(e) => { form.start_time = (e.target as HTMLInputElement).value }}
                    />
                  </div>

                  <div class="input-wrapper">
                    <label class="input-label" for="ecf-end">Время окончания</label>
                    <input
                      id="ecf-end"
                      type="time"
                      class={['input', formErrors.value.end_time && 'input--error']}
                      value={form.end_time}
                      aria-invalid={formErrors.value.end_time ? 'true' : undefined}
                      aria-describedby={formErrors.value.end_time ? 'ecf-end-error' : undefined}
                      onInput={(e) => { form.end_time = (e.target as HTMLInputElement).value }}
                    />
                    {formErrors.value.end_time && (
                      <p id="ecf-end-error" class="input-error" role="alert">
                        {formErrors.value.end_time}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ожидаемые гости */}
                <UiInput
                  id="ecf-guests"
                  label="Ожидаемое количество гостей"
                  type="number"
                  modelValue={form.expected_guests}
                  onUpdate:modelValue={(v: string) => { form.expected_guests = Number(v) }}
                  placeholder="20"
                  required
                  error={formErrors.value.expected_guests}
                />

                {/* Статус */}
                <UiSelect
                  id="ecf-status"
                  label="Начальный статус"
                  modelValue={form.status}
                  onUpdate:modelValue={(v: any) => { form.status = v }}
                  options={createStatusOptions}
                  required
                />

                {/* Короткое описание */}
                <div class="input-wrapper">
                  <label class="input-label" for="ecf-short-desc">
                    Короткое описание
                    <span class="ecf__char-count" aria-live="polite">
                      {shortDescLen.value}/300
                    </span>
                  </label>
                  <textarea
                    id="ecf-short-desc"
                    class={['input ecf__textarea ecf__textarea--sm', formErrors.value.short_description && 'input--error']}
                    value={form.short_description}
                    maxlength={300}
                    placeholder="Краткое описание для карточки (до 300 символов)"
                    aria-invalid={formErrors.value.short_description ? 'true' : undefined}
                    onInput={(e) => { form.short_description = (e.target as HTMLTextAreaElement).value }}
                  />
                  {formErrors.value.short_description && (
                    <p class="input-error" role="alert">{formErrors.value.short_description}</p>
                  )}
                </div>

                {/* Полное описание */}
                <div class="input-wrapper">
                  <label class="input-label" for="ecf-desc">Подробное описание</label>
                  <textarea
                    id="ecf-desc"
                    class="input ecf__textarea"
                    value={form.description}
                    placeholder="Подробная информация о мероприятии, программа, требования..."
                    onInput={(e) => { form.description = (e.target as HTMLTextAreaElement).value }}
                  />
                </div>
              </form>
            ),

            footer: () => (
              <>
                <button
                  type="button"
                  class="btn btn--secondary"
                  onClick={closeDialog}
                  disabled={submitting.value}
                >
                  Отмена
                </button>
                <UiButton
                  type="submit"
                  form="event-create-form"
                  variant="primary"
                  loading={submitting.value}
                  disabled={submitting.value}
                >
                  Создать мероприятие
                </UiButton>
              </>
            ),
          }}
        </UiDialog>
      </div>
    )
  },
})
