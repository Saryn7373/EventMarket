import { defineComponent, onMounted, computed, ref, reactive } from 'vue'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import {
  API_ENDPOINTS,
  USER_ROLES,
  BOOKING_STATUS_COLORS,
  HIRE_STATUS_COLORS,
  VENUE_STATUS,
  VENUE_STATUS_COLORS,
  EVENT_STATUS,
  EVENT_THEME_ICONS,
  EVENT_THEMES,
} from '~/utils/constants'
import type {
  BookingListInfo,
  BookingStatus,
  HireListInfo,
  Event,
  Venue,
  EventTheme,
  EventStatus,
} from '~/utils/types'
import UiDialog from '~/components/ui/Dialog'
import UiInput from '~/components/ui/Input'
import UiSelect from '~/components/ui/Select'
import UiAlert from '~/components/ui/Alert'
import UiButton from '~/components/ui/Button'

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

const todayStr = () => new Date().toISOString().split('T')[0]

// ─── Форма создания площадки ──────────────────────────────────────────────────

interface VenueForm {
  name: string
  city: string
  address: string
  postal_code: string
  capacity_min: number
  capacity_max: number
  area_sq_m: string
  price_per_hour: string
  price_per_day: string
  min_booking_hours: number
  short_description: string
  description: string
  cancellation_policy: string
}

const EMPTY_VENUE_FORM = (): VenueForm => ({
  name: '',
  city: '',
  address: '',
  postal_code: '',
  capacity_min: 10,
  capacity_max: 100,
  area_sq_m: '',
  price_per_hour: '',
  price_per_day: '',
  min_booking_hours: 2,
  short_description: '',
  description: '',
  cancellation_policy: '',
})

// ─── Компонент страницы ───────────────────────────────────────────────────────

export default defineComponent({
  name: 'DashboardPage',
  setup() {
    const userStore = useUserStore()
    const $api = useApi()

    // ── Состояние дашборда ──
    const loading = ref(true)
    const errorMessage = ref<string | null>(null)

    // Данные арендатора
    const myEvents = ref<Event[]>([])
    const totalCount = ref(0)

    // Данные владельца
    const myVenues      = ref<Venue[]>([])
    const venueBookings = ref<BookingListInfo[]>([])

    // ── Управление бронированиями (владелец) ──
    const processingBookingId     = ref<string | null>(null)
    const confirmBookingError     = ref('')
    const cancelBookingOpen       = ref(false)
    const cancelBookingId         = ref<string | null>(null)
    const cancelBookingSubmitting = ref(false)
    const cancelBookingError      = ref('')

    // Данные специалиста
    const specialistHires = ref<HireListInfo[]>([])

    // ── Фильтры и пагинация (арендатор) ──
    const statusFilter = ref<EventStatus | ''>('')
    const themeFilter = ref<string>('')
    const ordering = ref('-created_at')
    const currentPage = ref(1)
    const pageSize = ref(12)

    // ── Диалог создания мероприятия ──
    const dialogOpen = ref(false)
    const form = reactive<EventForm>(EMPTY_FORM())
    const formErrors = ref<Record<string, string>>({})
    const submitting = ref(false)
    const submitError = ref('')

    // ── Диалог создания площадки ──
    const venueDialogOpen = ref(false)
    const venueForm = reactive<VenueForm>(EMPTY_VENUE_FORM())
    const venueFormErrors = ref<Record<string, string>>({})
    const venueSubmitting = ref(false)
    const venueSubmitError = ref('')
    const venueFiles = ref<File[]>([])
    const venuePreviewUrls = ref<string[]>([])

    // ── Computed ──
    const userRole = computed(() => userStore.user?.role ?? 'unknown')
    const userRoleDisplay = computed(() => USER_ROLES[userRole.value])
    const shortDescLen = computed(() => form.short_description.length)
    const venueShortDescLen = computed(() => venueForm.short_description.length)
    const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

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

    const statusOptions = computed(() => [
      { value: '', label: 'Все статусы' },
      ...Object.entries(EVENT_STATUS).map(([v, l]) => ({ value: v, label: l })),
    ])

    const themeOptions = computed(() => [
      { value: '', label: 'Все тематики' },
      ...Object.entries(EVENT_THEMES).map(([v, l]) => ({ value: v, label: l })),
    ])

    const orderingOptions = [
      { value: '-created_at', label: 'Сначала новые' },
      { value: 'created_at',  label: 'Сначала старые' },
      { value: '-date',       label: 'По дате (убыв.)' },
      { value: 'date',        label: 'По дате (возр.)' },
      { value: '-expected_guests', label: 'По гостям (убыв.)' },
      { value: 'expected_guests',  label: 'По гостям (возр.)' },
    ]

    // ── Хелперы форматирования ──
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount)

    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const formatDateTime = (d: string) =>
      new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    const getStatusColor = (s: EventStatus): string =>
      ({
        draft:     '#6b7280',
        planned:   '#d97706',
        active:    '#2563eb',
        ongoing:   '#16a34a',
        completed: '#16a34a',
        cancelled: '#dc2626',
      }[s] ?? '#6b7280')

    // ── Загрузка данных ──
    const fetchAll = async <T,>(endpoint: string): Promise<T[]> => {
      const res = await $api.get<T[] | { results: T[] }>(endpoint, { params: { page_size: 100 } })
      if (Array.isArray(res)) return res
      return (res as { results: T[] }).results ?? []
    }

    const loadEvents = async () => {
      loading.value = true
      errorMessage.value = null
      try {
        const params: Record<string, any> = {
          page: currentPage.value,
          page_size: pageSize.value,
          ordering: ordering.value,
        }
        if (statusFilter.value) params.status = statusFilter.value
        if (themeFilter.value)  params.theme  = themeFilter.value

        const res = await $api.get<Event[] | { results: Event[]; count: number }>(
          API_ENDPOINTS.events.my,
          { params },
        )
        if (Array.isArray(res)) {
          myEvents.value = res
          totalCount.value = res.length
        } else {
          myEvents.value = res.results ?? []
          totalCount.value = res.count ?? 0
        }
      } catch (e: any) {
        errorMessage.value = e.message || 'Не удалось загрузить данные'
      } finally {
        loading.value = false
      }
    }

    const loadDashboardData = async () => {
      loading.value = true
      errorMessage.value = null
      try {
        switch (userRole.value) {
          case 'renter':
            await loadEvents()
            break
          case 'owner': {
            const [venues, bookings] = await Promise.all([
              fetchAll<Venue>(API_ENDPOINTS.venues.my),
              fetchAll<BookingListInfo>(API_ENDPOINTS.bookings.my),
            ])
            myVenues.value = venues
            venueBookings.value = bookings
            break
          }
          case 'specialist':
            specialistHires.value = await fetchAll<HireListInfo>(API_ENDPOINTS.hires.specialist)
            break
        }
      } catch (err: any) {
        errorMessage.value = err.message || 'Не удалось загрузить данные'
      } finally {
        loading.value = false
      }
    }

    onMounted(loadDashboardData)

    // ── Фильтры: обработчики ──
    const handleFilterChange = () => {
      currentPage.value = 1
      loadEvents()
    }

    const handlePageChange = (page: number) => {
      currentPage.value = page
      loadEvents()
    }

    // ── Диалог: функции ──
    const openDialog = () => {
      Object.assign(form, EMPTY_FORM())
      formErrors.value = {}
      submitError.value = ''
      dialogOpen.value = true
    }

    const closeDialog = () => { dialogOpen.value = false }

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
        if (e.data && typeof e.data === 'object' && !e.data.detail) {
          const serverErrs: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(e.data))
            serverErrs[field] = Array.isArray(msgs) ? (msgs as string[])[0] : String(msgs)
          formErrors.value = { ...formErrors.value, ...serverErrs }
        } else {
          submitError.value = e.data?.detail || e.message || 'Ошибка при создании мероприятия'
        }
      } finally {
        submitting.value = false
      }
    }

    // ── Диалог площадки: функции ──
    const openVenueDialog = () => {
      Object.assign(venueForm, EMPTY_VENUE_FORM())
      venueFormErrors.value = {}
      venueSubmitError.value = ''
      venueFiles.value = []
      venuePreviewUrls.value.forEach(u => URL.revokeObjectURL(u))
      venuePreviewUrls.value = []
      venueDialogOpen.value = true
    }

    const closeVenueDialog = () => {
      venuePreviewUrls.value.forEach(u => URL.revokeObjectURL(u))
      venuePreviewUrls.value = []
      venueDialogOpen.value = false
    }

    const handleVenueFiles = (e: Event) => {
      const input = e.target as HTMLInputElement
      if (!input.files) return
      venuePreviewUrls.value.forEach(u => URL.revokeObjectURL(u))
      venueFiles.value = Array.from(input.files)
      venuePreviewUrls.value = venueFiles.value.map(f => URL.createObjectURL(f))
    }

    const removeVenueFile = (index: number) => {
      URL.revokeObjectURL(venuePreviewUrls.value[index])
      venueFiles.value = venueFiles.value.filter((_, i) => i !== index)
      venuePreviewUrls.value = venuePreviewUrls.value.filter((_, i) => i !== index)
    }

    const validateVenueForm = (): boolean => {
      const errs: Record<string, string> = {}
      if (!venueForm.name.trim()) errs.name = 'Название обязательно'
      else if (venueForm.name.length > 200) errs.name = 'Не более 200 символов'
      if (!venueForm.city.trim()) errs.city = 'Город обязателен'
      if (!venueForm.address.trim()) errs.address = 'Адрес обязателен'
      if (!venueForm.capacity_min || venueForm.capacity_min < 1) errs.capacity_min = 'Не менее 1'
      if (!venueForm.capacity_max || venueForm.capacity_max < 1) errs.capacity_max = 'Не менее 1'
      if (venueForm.capacity_min && venueForm.capacity_max && Number(venueForm.capacity_min) > Number(venueForm.capacity_max))
        errs.capacity_min = 'Мин. не может быть больше макс.'
      if (venueForm.short_description.length > 300) errs.short_description = 'Не более 300 символов'
      venueFormErrors.value = errs
      return Object.keys(errs).length === 0
    }

    const submitVenueForm = async () => {
      if (!validateVenueForm()) return
      venueSubmitting.value = true
      venueSubmitError.value = ''
      try {
        const payload: Record<string, any> = {
          name: venueForm.name.trim(),
          city: venueForm.city.trim(),
          address: venueForm.address.trim(),
          capacity_min: Number(venueForm.capacity_min),
          capacity_max: Number(venueForm.capacity_max),
          min_booking_hours: Number(venueForm.min_booking_hours),
        }
        if (venueForm.postal_code.trim()) payload.postal_code = venueForm.postal_code.trim()
        if (venueForm.area_sq_m !== '') payload.area_sq_m = Number(venueForm.area_sq_m)
        if (venueForm.price_per_hour !== '') payload.price_per_hour = Number(venueForm.price_per_hour)
        if (venueForm.price_per_day !== '') payload.price_per_day = Number(venueForm.price_per_day)
        if (venueForm.short_description.trim()) payload.short_description = venueForm.short_description.trim()
        if (venueForm.description.trim()) payload.description = venueForm.description.trim()
        if (venueForm.cancellation_policy.trim()) payload.cancellation_policy = venueForm.cancellation_policy.trim()

        const created = await $api.post<Venue>(API_ENDPOINTS.venues.list, payload)

        for (let i = 0; i < venueFiles.value.length; i++) {
          const fd = new FormData()
          fd.append('image', venueFiles.value[i])
          fd.append('order', String(i))
          await $api.post(API_ENDPOINTS.venues.images(created.id), fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }

        closeVenueDialog()
        await loadDashboardData()
      } catch (e: any) {
        if (e.data && typeof e.data === 'object' && !e.data.detail) {
          const serverErrs: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(e.data))
            serverErrs[field] = Array.isArray(msgs) ? (msgs as string[])[0] : String(msgs)
          venueFormErrors.value = { ...venueFormErrors.value, ...serverErrs }
        } else {
          venueSubmitError.value = e.data?.detail || e.message || 'Ошибка при создании площадки'
        }
      } finally {
        venueSubmitting.value = false
      }
    }

    // ── Изменение статуса бронирования ──
    const applyBookingStatus = async (id: string, newStatus: 'confirmed' | 'cancelled') => {
      const res = await $api.patch<{ status: string; status_display: string }>(
        API_ENDPOINTS.bookings.status(id),
        { status: newStatus },
      )
      const idx = venueBookings.value.findIndex(b => b.id === id)
      if (idx >= 0) {
        venueBookings.value[idx] = {
          ...venueBookings.value[idx],
          status: res.status as BookingStatus,
          status_display: res.status_display,
        }
      }
    }

    const confirmBooking = async (id: string) => {
      processingBookingId.value = id
      confirmBookingError.value = ''
      try {
        await applyBookingStatus(id, 'confirmed')
      } catch (e: any) {
        confirmBookingError.value = e.data?.detail || e.message || 'Ошибка при подтверждении'
      } finally {
        processingBookingId.value = null
      }
    }

    const openCancelBooking = (id: string) => {
      cancelBookingId.value  = id
      cancelBookingError.value = ''
      cancelBookingOpen.value = true
    }

    const closeCancelBooking = () => {
      cancelBookingOpen.value = false
      cancelBookingId.value   = null
    }

    const submitCancelBooking = async () => {
      if (!cancelBookingId.value) return
      cancelBookingSubmitting.value = true
      cancelBookingError.value      = ''
      try {
        await applyBookingStatus(cancelBookingId.value, 'cancelled')
        closeCancelBooking()
      } catch (e: any) {
        cancelBookingError.value = e.data?.detail || e.message || 'Ошибка при отмене'
      } finally {
        cancelBookingSubmitting.value = false
      }
    }

    // ── Хелперы рендера ──
    const renderStatusBadge = (label: string, color: string) => (
      <span class={`badge badge--${color}`}>
        <span class="sr-only">Статус: </span>
        {label}
      </span>
    )

    const renderEmpty = (
      icon: string,
      title: string,
      hint: string,
      action?: { label: string; onClick: () => void },
    ) => (
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

    // ── Вид Арендатора ──
    const renderRenter = () => (
      <>
        {/* Фильтры + кнопка создания */}
        <div class="page-header">
          <div />
          <UiButton variant="primary" onClick={openDialog}>
            <span aria-hidden="true">+</span> Создать мероприятие
          </UiButton>
        </div>

        <form
          class="filters-bar"
          role="search"
          aria-label="Фильтры мероприятий"
          onSubmit={(e) => e.preventDefault()}
        >
          <div class="filter-item">
            <UiSelect
              id="dash-filter-status"
              label="Статус"
              modelValue={statusFilter.value}
              onUpdate:modelValue={(v: any) => { statusFilter.value = v; handleFilterChange() }}
              options={statusOptions.value}
            />
          </div>
          <div class="filter-item">
            <UiSelect
              id="dash-filter-theme"
              label="Тематика"
              modelValue={themeFilter.value}
              onUpdate:modelValue={(v: any) => { themeFilter.value = v; handleFilterChange() }}
              options={themeOptions.value}
            />
          </div>
          <div class="filter-item">
            <UiSelect
              id="dash-filter-ordering"
              label="Сортировка"
              modelValue={ordering.value}
              onUpdate:modelValue={(v: any) => { ordering.value = v; handleFilterChange() }}
              options={orderingOptions}
            />
          </div>
        </form>

        {myEvents.value.length === 0
          ? renderEmpty(
              '🎉',
              'У вас пока нет мероприятий',
              'Создайте первое мероприятие, чтобы бронировать площадки и нанимать специалистов',
              { label: '+ Создать мероприятие', onClick: openDialog },
            )
          : (
            <>
              <p class="results-info" aria-live="polite">Найдено: {totalCount.value} мероприятий</p>

              <ul class="events-grid" aria-label="Список ваших мероприятий">
                {myEvents.value.map((ev) => {
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
                            <dd class="detail-value">{ev.theme_display ?? EVENT_THEMES[ev.theme] ?? ev.theme}</dd>
                          </div>
                          <div class="event-detail">
                            <dt class="detail-label">Гостей:</dt>
                            <dd class="detail-value">{ev.expected_guests}</dd>
                          </div>
                        </dl>

                        <div class="event-footer">
                          <a
                            href={`/events/${ev.id}`}
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
      </>
    )

    // ── Вид Владельца ──
    const renderOwner = () => (
      <>
        <section class="dashboard-section" aria-labelledby="owner-venues-title">
          <div class="section-header">
            <h2 id="owner-venues-title" class="section-title">Мои площадки</h2>
            <UiButton variant="primary" onClick={openVenueDialog}>
              <span aria-hidden="true">+</span> Добавить площадку
            </UiButton>
          </div>

          {myVenues.value.length === 0
            ? renderEmpty(
                '🏛️',
                'У вас пока нет площадок',
                'Зарегистрируйте свою первую площадку, чтобы принимать бронирования',
                { label: '+ Добавить площадку', onClick: openVenueDialog },
              )
            : (
              <ul class="venue-grid" aria-label="Список ваших площадок">
                {myVenues.value.map((venue) => {
                  const titleId = `venue-${venue.id}-title`
                  return (
                    <li key={venue.id}>
                      <article class="venue-card" aria-labelledby={titleId}>
                        <header class="venue-card-header">
                          <h3 id={titleId} class="venue-card-title">
                            <a class="venue-card-link" href={`/venues/${venue.slug}`}>
                              {venue.name}
                            </a>
                          </h3>
                          {renderStatusBadge(VENUE_STATUS[venue.status] ?? venue.status, VENUE_STATUS_COLORS[venue.status] ?? 'gray')}
                        </header>
                        <div class="venue-card-meta">
                          <div>{venue.city}, {venue.address}</div>
                          <div>Вместимость: {venue.capacity_min}–{venue.capacity_max} чел.</div>
                        </div>
                        <div class="venue-card-prices">
                          {venue.price_per_hour && <span>{formatCurrency(Number(venue.price_per_hour))} / час</span>}
                          {venue.price_per_day && <span>{formatCurrency(Number(venue.price_per_day))} / сутки</span>}
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

          {confirmBookingError.value && (
            <div class="booking-alert">
              <UiAlert variant="error" title="Ошибка">{confirmBookingError.value}</UiAlert>
            </div>
          )}

          {venueBookings.value.length === 0
            ? <div class="empty-state"><p>Пока никто не бронировал ваши площадки</p></div>
            : (
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
                      <th scope="col">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venueBookings.value.map((b) => {
                      const isProcessing = processingBookingId.value === b.id
                      return (
                        <tr key={b.id}>
                          <td><strong>{b.venue_name}</strong><div class="muted text-sm">{b.venue_city}</div></td>
                          <td>{b.event_title}</td>
                          <td>
                            <div>{formatDateTime(b.start_datetime)}</div>
                            <div class="muted text-sm">до {formatDateTime(b.end_datetime)}</div>
                          </td>
                          <td class="text-semibold">{formatCurrency(b.total_price)}</td>
                          <td>{renderStatusBadge(b.status_display, BOOKING_STATUS_COLORS[b.status] ?? 'gray')}</td>
                          <td class="booking-actions-cell">
                            {b.status === 'pending' && (
                              <div class="booking-actions">
                                <button
                                  type="button"
                                  class="btn btn--primary btn--sm"
                                  onClick={() => confirmBooking(b.id)}
                                  disabled={isProcessing}
                                  aria-busy={isProcessing ? 'true' : undefined}
                                >
                                  {isProcessing
                                    ? <span class="spinner" aria-hidden="true" />
                                    : 'Подтвердить'}
                                </button>
                                <button
                                  type="button"
                                  class="btn btn--danger btn--sm"
                                  onClick={() => openCancelBooking(b.id)}
                                  disabled={isProcessing}
                                >
                                  Отменить
                                </button>
                              </div>
                            )}
                            {b.status === 'confirmed' && (
                              <button
                                type="button"
                                class="btn btn--danger btn--sm"
                                onClick={() => openCancelBooking(b.id)}
                              >
                                Отменить
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </section>

        {/* ── Диалог отмены бронирования ── */}
        <UiDialog
          open={cancelBookingOpen.value}
          title="Отменить бронирование?"
          size="sm"
          onClose={closeCancelBooking}
        >
          {{
            default: () => (
              <div class="ep-cancel-confirm">
                <p class="ep-cancel-confirm__text">
                  Вы уверены, что хотите отменить это бронирование?
                  Арендатор получит уведомление об отмене.
                </p>
                {cancelBookingError.value && (
                  <div class="ecf__alert">
                    <UiAlert variant="error" title="Ошибка">{cancelBookingError.value}</UiAlert>
                  </div>
                )}
              </div>
            ),
            footer: () => (
              <>
                <button
                  type="button"
                  class="btn btn--secondary"
                  onClick={closeCancelBooking}
                  disabled={cancelBookingSubmitting.value}
                >
                  Не отменять
                </button>
                <button
                  type="button"
                  class="btn btn--danger"
                  onClick={submitCancelBooking}
                  disabled={cancelBookingSubmitting.value}
                  aria-busy={cancelBookingSubmitting.value ? 'true' : undefined}
                >
                  {cancelBookingSubmitting.value
                    ? <><span class="spinner" aria-hidden="true" /><span class="sr-only">Отмена</span></>
                    : 'Да, отменить'}
                </button>
              </>
            ),
          }}
        </UiDialog>
      </>
    )

    // ── Диалог создания площадки ──
    const renderVenueDialog = () => (
      <UiDialog
        open={venueDialogOpen.value}
        title="Новая площадка"
        size="lg"
        onClose={closeVenueDialog}
      >
        {{
          default: () => (
            <form
              id="dash-venue-form"
              class="vcf"
              onSubmit={(e) => { e.preventDefault(); submitVenueForm() }}
              novalidate
              aria-label="Форма создания площадки"
            >
              {venueSubmitError.value && (
                <div class="vcf__alert">
                  <UiAlert variant="error" title="Ошибка">{venueSubmitError.value}</UiAlert>
                </div>
              )}

              <UiInput
                id="dash-vcf-name"
                label="Название площадки"
                modelValue={venueForm.name}
                onUpdate:modelValue={(v: string) => { venueForm.name = v }}
                placeholder="Например: Лофт на Покровке"
                required
                error={venueFormErrors.value.name}
              />

              <div class="vcf__row-3">
                <UiInput
                  id="dash-vcf-city"
                  label="Город"
                  modelValue={venueForm.city}
                  onUpdate:modelValue={(v: string) => { venueForm.city = v }}
                  placeholder="Москва"
                  required
                  error={venueFormErrors.value.city}
                />
                <UiInput
                  id="dash-vcf-address"
                  label="Адрес"
                  modelValue={venueForm.address}
                  onUpdate:modelValue={(v: string) => { venueForm.address = v }}
                  placeholder="ул. Примерная, 1"
                  required
                  error={venueFormErrors.value.address}
                />
                <UiInput
                  id="dash-vcf-postal"
                  label="Почтовый индекс"
                  modelValue={venueForm.postal_code}
                  onUpdate:modelValue={(v: string) => { venueForm.postal_code = v }}
                  placeholder="101000"
                  error={venueFormErrors.value.postal_code}
                />
              </div>

              <div class="vcf__row-3">
                <UiInput
                  id="dash-vcf-cap-min"
                  label="Мин. вместимость"
                  type="number"
                  modelValue={venueForm.capacity_min}
                  onUpdate:modelValue={(v: string) => { venueForm.capacity_min = Number(v) }}
                  placeholder="10"
                  required
                  error={venueFormErrors.value.capacity_min}
                />
                <UiInput
                  id="dash-vcf-cap-max"
                  label="Макс. вместимость"
                  type="number"
                  modelValue={venueForm.capacity_max}
                  onUpdate:modelValue={(v: string) => { venueForm.capacity_max = Number(v) }}
                  placeholder="100"
                  required
                  error={venueFormErrors.value.capacity_max}
                />
                <UiInput
                  id="dash-vcf-area"
                  label="Площадь, м²"
                  type="number"
                  modelValue={venueForm.area_sq_m}
                  onUpdate:modelValue={(v: string) => { venueForm.area_sq_m = v }}
                  placeholder="200"
                  error={venueFormErrors.value.area_sq_m}
                />
              </div>

              <div class="vcf__row-3">
                <UiInput
                  id="dash-vcf-price-hour"
                  label="Цена за час, ₽"
                  type="number"
                  modelValue={venueForm.price_per_hour}
                  onUpdate:modelValue={(v: string) => { venueForm.price_per_hour = v }}
                  placeholder="2000"
                  error={venueFormErrors.value.price_per_hour}
                />
                <UiInput
                  id="dash-vcf-price-day"
                  label="Цена за сутки, ₽"
                  type="number"
                  modelValue={venueForm.price_per_day}
                  onUpdate:modelValue={(v: string) => { venueForm.price_per_day = v }}
                  placeholder="15000"
                  error={venueFormErrors.value.price_per_day}
                />
                <UiInput
                  id="dash-vcf-min-hours"
                  label="Мин. бронирование, ч"
                  type="number"
                  modelValue={venueForm.min_booking_hours}
                  onUpdate:modelValue={(v: string) => { venueForm.min_booking_hours = Number(v) }}
                  placeholder="2"
                  required
                  error={venueFormErrors.value.min_booking_hours}
                />
              </div>

              <div class="input-wrapper">
                <label class="input-label" for="dash-vcf-short">
                  Короткое описание
                  <span class="ecf__char-count" aria-live="polite">{venueShortDescLen.value}/300</span>
                </label>
                <textarea
                  id="dash-vcf-short"
                  class={['input ecf__textarea ecf__textarea--sm', venueFormErrors.value.short_description && 'input--error']}
                  value={venueForm.short_description}
                  maxlength={300}
                  placeholder="Краткое описание для карточки (до 300 символов)"
                  onInput={(e) => { venueForm.short_description = (e.target as HTMLTextAreaElement).value }}
                />
                {venueFormErrors.value.short_description && (
                  <p class="input-error" role="alert">{venueFormErrors.value.short_description}</p>
                )}
              </div>

              <div class="input-wrapper">
                <label class="input-label" for="dash-vcf-desc">Подробное описание</label>
                <textarea
                  id="dash-vcf-desc"
                  class="input ecf__textarea"
                  value={venueForm.description}
                  placeholder="Подробная информация о площадке, особенности, оборудование..."
                  onInput={(e) => { venueForm.description = (e.target as HTMLTextAreaElement).value }}
                />
              </div>

              <div class="input-wrapper">
                <label class="input-label" for="dash-vcf-cancel">Политика отмены</label>
                <textarea
                  id="dash-vcf-cancel"
                  class="input ecf__textarea ecf__textarea--sm"
                  value={venueForm.cancellation_policy}
                  placeholder="Например: бесплатная отмена за 48 часов до начала"
                  onInput={(e) => { venueForm.cancellation_policy = (e.target as HTMLTextAreaElement).value }}
                />
              </div>

              <div class="input-wrapper">
                <span class="input-label">Фотографии</span>
                <label for="dash-vcf-photos" class="vcf__file-label">
                  <span aria-hidden="true">📁</span> Выбрать фотографии
                </label>
                <input
                  id="dash-vcf-photos"
                  type="file"
                  class="vcf__file-input"
                  multiple
                  accept="image/*"
                  aria-label="Фотографии площадки"
                  onChange={handleVenueFiles}
                />
                {venuePreviewUrls.value.length > 0 && (
                  <div class="vcf__photo-grid" role="list" aria-label="Выбранные фотографии">
                    {venuePreviewUrls.value.map((url, i) => (
                      <div key={url} class="vcf__photo-item" role="listitem">
                        <img src={url} alt={`Фото ${i + 1}`} class="vcf__photo-img" />
                        <button
                          type="button"
                          class="vcf__photo-remove"
                          aria-label={`Удалить фото ${i + 1}`}
                          onClick={() => removeVenueFile(i)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          ),

          footer: () => (
            <>
              <button
                type="button"
                class="btn btn--secondary"
                onClick={closeVenueDialog}
                disabled={venueSubmitting.value}
              >
                Отмена
              </button>
              <button
                type="submit"
                form="dash-venue-form"
                class="btn btn--primary"
                disabled={venueSubmitting.value}
                aria-busy={venueSubmitting.value ? 'true' : undefined}
              >
                {venueSubmitting.value
                  ? <><span class="spinner" aria-hidden="true" /> <span class="sr-only">Создание</span></>
                  : 'Создать площадку'}
              </button>
            </>
          ),
        }}
      </UiDialog>
    )

    // ── Вид Специалиста ──
    const renderSpecialist = () => (
      <section class="dashboard-section" aria-labelledby="specialist-hires-title">
        <div class="section-header">
          <h2 id="specialist-hires-title" class="section-title">Мероприятия, на которые меня наняли</h2>
        </div>

        {specialistHires.value.length === 0
          ? renderEmpty('🤝', 'Вас пока никто не нанял', 'Когда арендаторы пригласят вас на мероприятие, они появятся здесь')
          : (
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
                    <tr key={h.id}>
                      <td><strong>{h.event_title}</strong></td>
                      <td>{formatDate(h.event_date)}</td>
                      <td>
                        <div>{formatDateTime(h.start_datetime)}</div>
                        <div class="muted text-sm">до {formatDateTime(h.end_datetime)}</div>
                      </td>
                      <td>{h.duration_hours}</td>
                      <td class="text-semibold">{formatCurrency(h.total_price)}</td>
                      <td>{renderStatusBadge(h.status_display, HIRE_STATUS_COLORS[h.status] ?? 'gray')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    )

    // ── Заголовки по роли ──
    const headerByRole: Record<string, { title: string; subtitle: string }> = {
      renter:    { title: 'Мои мероприятия',  subtitle: 'Создавайте мероприятия, бронируйте площадки и нанимайте специалистов' },
      owner:     { title: 'Мои площадки',     subtitle: 'Управляйте площадками и отслеживайте бронирования' },
      specialist:{ title: 'Мои наймы',        subtitle: 'Мероприятия, на которые вас пригласили' },
      admin:     { title: 'Дашборд',          subtitle: 'Администрирование платформы' },
      unknown:   { title: 'Дашборд',          subtitle: 'Профиль без роли — обратитесь к администратору' },
    }

    // ─── Render ────────────────────────────────────────────────────────────────
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
                <div class="spinner" aria-hidden="true" />
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
                {userRole.value === 'renter'     && renderRenter()}
                {userRole.value === 'owner'      && renderOwner()}
                {userRole.value === 'specialist' && renderSpecialist()}
                {(userRole.value === 'admin' || userRole.value === 'unknown') && (
                  <div class="empty-state">
                    <p>Для вашей роли дашборд пока не настроен.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Диалог создания площадки (только для владельцев) ── */}
          {userRole.value === 'owner' && renderVenueDialog()}

          {/* ── Диалог создания мероприятия (только для арендаторов) ── */}
          {userRole.value === 'renter' && (
            <UiDialog
              open={dialogOpen.value}
              title="Новое мероприятие"
              size="lg"
              onClose={closeDialog}
            >
              {{
                default: () => (
                  <form
                    id="dash-event-form"
                    class="ecf"
                    onSubmit={(e) => { e.preventDefault(); submitForm() }}
                    novalidate
                    aria-label="Форма создания мероприятия"
                  >
                    {submitError.value && (
                      <div class="ecf__alert">
                        <UiAlert variant="error" title="Ошибка">{submitError.value}</UiAlert>
                      </div>
                    )}

                    <UiInput
                      id="dash-ecf-title"
                      label="Название мероприятия"
                      modelValue={form.title}
                      onUpdate:modelValue={(v: string) => { form.title = v }}
                      placeholder="Например: День рождения компании"
                      required
                      error={formErrors.value.title}
                    />

                    <UiSelect
                      id="dash-ecf-theme"
                      label="Тематика"
                      modelValue={form.theme}
                      onUpdate:modelValue={(v: any) => { form.theme = v }}
                      options={createThemeOptions.value}
                      required
                      error={formErrors.value.theme}
                    />

                    <div class="ecf__row">
                      <div class="input-wrapper">
                        <label class="input-label" for="dash-ecf-date">
                          Дата проведения
                          <span class="input-required" aria-hidden="true">*</span>
                          <span class="sr-only"> (обязательно)</span>
                        </label>
                        <input
                          id="dash-ecf-date"
                          type="date"
                          class={['input', formErrors.value.date && 'input--error']}
                          value={form.date}
                          min={todayStr()}
                          required
                          aria-invalid={formErrors.value.date ? 'true' : undefined}
                          aria-describedby={formErrors.value.date ? 'dash-ecf-date-err' : undefined}
                          onInput={(e) => { form.date = (e.target as HTMLInputElement).value }}
                        />
                        {formErrors.value.date && (
                          <p id="dash-ecf-date-err" class="input-error" role="alert">
                            {formErrors.value.date}
                          </p>
                        )}
                      </div>

                      <div class="input-wrapper">
                        <label class="input-label" for="dash-ecf-start">Время начала</label>
                        <input
                          id="dash-ecf-start"
                          type="time"
                          class="input"
                          value={form.start_time}
                          onInput={(e) => { form.start_time = (e.target as HTMLInputElement).value }}
                        />
                      </div>

                      <div class="input-wrapper">
                        <label class="input-label" for="dash-ecf-end">Время окончания</label>
                        <input
                          id="dash-ecf-end"
                          type="time"
                          class={['input', formErrors.value.end_time && 'input--error']}
                          value={form.end_time}
                          aria-invalid={formErrors.value.end_time ? 'true' : undefined}
                          aria-describedby={formErrors.value.end_time ? 'dash-ecf-end-err' : undefined}
                          onInput={(e) => { form.end_time = (e.target as HTMLInputElement).value }}
                        />
                        {formErrors.value.end_time && (
                          <p id="dash-ecf-end-err" class="input-error" role="alert">
                            {formErrors.value.end_time}
                          </p>
                        )}
                      </div>
                    </div>

                    <UiInput
                      id="dash-ecf-guests"
                      label="Ожидаемое количество гостей"
                      type="number"
                      modelValue={form.expected_guests}
                      onUpdate:modelValue={(v: string) => { form.expected_guests = Number(v) }}
                      placeholder="20"
                      required
                      error={formErrors.value.expected_guests}
                    />

                    <UiSelect
                      id="dash-ecf-status"
                      label="Начальный статус"
                      modelValue={form.status}
                      onUpdate:modelValue={(v: any) => { form.status = v }}
                      options={createStatusOptions}
                      required
                    />

                    <div class="input-wrapper">
                      <label class="input-label" for="dash-ecf-short">
                        Короткое описание
                        <span class="ecf__char-count" aria-live="polite">{shortDescLen.value}/300</span>
                      </label>
                      <textarea
                        id="dash-ecf-short"
                        class={['input ecf__textarea ecf__textarea--sm', formErrors.value.short_description && 'input--error']}
                        value={form.short_description}
                        maxlength={300}
                        placeholder="Краткое описание для карточки (до 300 символов)"
                        onInput={(e) => { form.short_description = (e.target as HTMLTextAreaElement).value }}
                      />
                      {formErrors.value.short_description && (
                        <p class="input-error" role="alert">{formErrors.value.short_description}</p>
                      )}
                    </div>

                    <div class="input-wrapper">
                      <label class="input-label" for="dash-ecf-desc">Подробное описание</label>
                      <textarea
                        id="dash-ecf-desc"
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
                    <button
                      type="submit"
                      form="dash-event-form"
                      class="btn btn--primary"
                      disabled={submitting.value}
                      aria-busy={submitting.value ? 'true' : undefined}
                    >
                      {submitting.value
                        ? <><span class="spinner" aria-hidden="true" /> <span class="sr-only">Создание</span></>
                        : 'Создать мероприятие'}
                    </button>
                  </>
                ),
              }}
            </UiDialog>
          )}
        </div>
      )
    }
  },
})
