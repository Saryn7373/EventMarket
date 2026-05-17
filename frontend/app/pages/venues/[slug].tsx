import { defineComponent, ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useUserStore } from '~/stores/user'
import { API_ENDPOINTS } from '~/utils/constants'
import type { Venue, Event, BusySlot } from '~/utils/types'
import UiDialog from '~/components/ui/Dialog'
import UiSelect from '~/components/ui/Select'
import UiAlert from '~/components/ui/Alert'

interface EditForm {
  name: string
  city: string
  postal_code: string
  latitude: string
  longitude: string
  capacity_min: number
  capacity_max: number
  area_sq_m: string
  min_booking_hours: number
  short_description: string
  description: string
  cancellation_policy: string
}

export default defineComponent({
  name: 'VenueDetailPage',
  setup() {
    const route     = useRoute()
    const router    = useRouter()
    const $api      = useApi()
    const userStore = useUserStore()

    // ── Данные площадки ──
    const venue              = ref<Venue | null>(null)
    const loading            = ref(true)
    const error              = ref<string | null>(null)
    const currentImageIndex  = ref(0)

    const slug       = computed(() => route.params.slug as string)
    const images     = computed(() => venue.value?.images ?? [])
    const hasImages  = computed(() => images.value.length > 0)
    const currentImage = computed(() => images.value[currentImageIndex.value] ?? null)
    const totalImages  = computed(() => images.value.length)

    const prevImage  = () => { if (currentImageIndex.value > 0) currentImageIndex.value-- }
    const nextImage  = () => { if (currentImageIndex.value < totalImages.value - 1) currentImageIndex.value++ }
    const goToImage  = (idx: number) => { currentImageIndex.value = idx }

    // ── Пользователь ──
    const isLoggedIn = computed(() => !!userStore.user)
    const isRenter   = computed(() => userStore.user?.role === 'renter')
    const isOwner    = computed(() => !!userStore.user && userStore.user.email === venue.value?.owner_email)

    // ── Диалог бронирования ──
    const bookingOpen     = ref(false)
    const myEvents        = ref<Event[]>([])
    const eventsLoading   = ref(false)
    const selectedEventId = ref('')
    const selectedEvent   = ref<Event | null>(null)
    const bookingStart    = ref('')
    const bookingEnd      = ref('')
    const timeConflict    = ref(false)
    const eventHasVenue   = ref(false)
    const submitting      = ref(false)
    const submitError     = ref('')
    const bookingSuccess  = ref(false)

    // ── Наличие активных броней (для владельца, из данных площадки) ──
    const bookingsChecked   = computed(() => !loading.value && !!venue.value)
    const hasActiveBookings = computed(() => venue.value?.has_active_bookings ?? false)

    // ── Диалог редактирования ──
    const editOpen       = ref(false)
    const editSubmitting = ref(false)
    const editError      = ref('')

    const editForm = reactive<EditForm>({
      name: '', city: '', postal_code: '',
      latitude: '', longitude: '',
      capacity_min: 10, capacity_max: 100,
      area_sq_m: '', min_booking_hours: 2,
      short_description: '', description: '',
      cancellation_policy: '',
    })

    // ── Фото в форме редактирования ──
    const pendingDeleteIds  = ref<number[]>([])
    const newEditFiles      = ref<File[]>([])
    const newEditPreviews   = ref<string[]>([])

    // ── Диалог удаления ──
    const deleteOpen       = ref(false)
    const deleteSubmitting = ref(false)
    const deleteError      = ref('')

    // ── Форматирование ──
    const formatCurrency = (amount: string | number | null): string => {
      if (!amount) return 'Не указана'
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency', currency: 'RUB', minimumFractionDigits: 0,
      }).format(Number(amount))
    }

    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

    // ── Загрузка площадки ──
    onMounted(async () => {
      try {
        venue.value = await $api.get<Venue>(API_ENDPOINTS.venues.bySlug(slug.value))
      } catch (e: any) {
        error.value = e.statusCode === 404
          ? 'Площадка не найдена или снята с публикации.'
          : e.message || 'Ошибка загрузки данных'
      } finally {
        loading.value = false
      }
    })

    // ── Варианты мероприятий для селектора ──
    const activeEvents = computed(() =>
      myEvents.value.filter(ev => !['draft', 'cancelled', 'completed'].includes(ev.status)),
    )

    const eventOptions = computed(() => [
      { value: '', label: 'Выберите мероприятие...' },
      ...activeEvents.value.map(ev => ({
        value: ev.id,
        label: `${ev.title} — ${formatDate(ev.date)}`,
      })),
    ])

    // ── Примерная стоимость ──
    const estimatedPrice = computed((): number | null => {
      if (!venue.value || !bookingStart.value || !bookingEnd.value) return null
      const start = new Date(bookingStart.value).getTime()
      const end   = new Date(bookingEnd.value).getTime()
      if (end <= start) return null
      const hours = (end - start) / 3_600_000
      if (venue.value.price_per_hour) return hours * Number(venue.value.price_per_hour)
      if (venue.value.price_per_day)  return (hours / 24) * Number(venue.value.price_per_day)
      return null
    })

    // ── Открыть диалог бронирования ──
    const openBookingDialog = async () => {
      selectedEventId.value = ''
      selectedEvent.value   = null
      bookingStart.value    = ''
      bookingEnd.value      = ''
      timeConflict.value    = false
      eventHasVenue.value   = false
      submitError.value     = ''
      bookingSuccess.value  = false
      bookingOpen.value     = true

      eventsLoading.value = true
      try {
        const res = await $api.get<Event[] | { results: Event[] }>(
          API_ENDPOINTS.events.my, { params: { page_size: 100 } },
        )
        myEvents.value = Array.isArray(res) ? res : (res.results ?? [])
      } catch {
        myEvents.value = []
      } finally {
        eventsLoading.value = false
      }
    }

    const closeBookingDialog = () => { bookingOpen.value = false }

    // ── Проверка доступности площадки ──
    const checkAvailability = async () => {
      if (!venue.value || !bookingStart.value || !bookingEnd.value) return
      timeConflict.value = false
      try {
        const date = bookingStart.value.split('T')[0]
        const res = await $api.get<{ venue_id: string; busy_slots: BusySlot[] }>(
          API_ENDPOINTS.venues.availability(venue.value.id),
          { params: { from: `${date}T00:00:00`, to: `${date}T23:59:59` } },
        )
        const reqStart = new Date(bookingStart.value).getTime()
        const reqEnd   = new Date(bookingEnd.value).getTime()
        timeConflict.value = res.busy_slots.some(slot => {
          const s = new Date(slot.start_datetime).getTime()
          const e = new Date(slot.end_datetime).getTime()
          return reqStart < e && reqEnd > s
        })
      } catch {
        /* игнорируем ошибки проверки — бэкенд проверит при создании */
      }
    }

    // ── Выбор мероприятия ──
    const onEventChange = async (eventId: string) => {
      selectedEventId.value = eventId
      selectedEvent.value   = null
      timeConflict.value    = false
      eventHasVenue.value   = false
      bookingStart.value    = ''
      bookingEnd.value      = ''
      if (!eventId || !venue.value) return

      try {
        const ev = await $api.get<Event>(API_ENDPOINTS.events.detail(eventId))
        selectedEvent.value = ev
        eventHasVenue.value = ev.venues.length > 0
        if (!eventHasVenue.value) {
          const date      = ev.date
          const startTime = ev.start_time?.slice(0, 5) ?? '10:00'
          const endTime   = ev.end_time?.slice(0, 5) ?? ''
          bookingStart.value = `${date}T${startTime}`
          if (endTime) {
            bookingEnd.value = `${date}T${endTime}`
          } else {
            const [hh, mm] = startTime.split(':').map(Number)
            const minH     = venue.value!.min_booking_hours ?? 2
            const endH     = String((hh + minH) % 24).padStart(2, '0')
            bookingEnd.value = `${date}T${endH}:${String(mm).padStart(2, '0')}`
          }
          await checkAvailability()
        }
      } catch {
        /* ignore */
      }
    }

    // ── Отправка бронирования ──
    const submitBooking = async () => {
      if (!selectedEventId.value || !bookingStart.value || !bookingEnd.value || !venue.value) return
      submitting.value  = true
      submitError.value = ''
      try {
        const toISO = (s: string) => s.length === 16 ? `${s}:00` : s
        await $api.post(API_ENDPOINTS.bookings.list, {
          venue:          venue.value.id,
          event:          selectedEventId.value,
          start_datetime: toISO(bookingStart.value),
          end_datetime:   toISO(bookingEnd.value),
        })
        bookingSuccess.value = true
      } catch (e: any) {
        if (e.data && typeof e.data === 'object' && !e.data.detail) {
          submitError.value = (Object.values(e.data) as any[]).flat().join(' ')
        } else {
          submitError.value = e.data?.detail || e.message || 'Ошибка при бронировании'
        }
      } finally {
        submitting.value = false
      }
    }

    // ── Открыть диалог редактирования ──
    const openEditDialog = () => {
      if (!venue.value) return
      const v = venue.value
      Object.assign(editForm, {
        name:                v.name,
        city:                v.city,
        postal_code:         v.postal_code ?? '',
        latitude:            v.latitude  != null ? String(v.latitude)  : '',
        longitude:           v.longitude != null ? String(v.longitude) : '',
        capacity_min:        v.capacity_min,
        capacity_max:        v.capacity_max,
        area_sq_m:           v.area_sq_m != null ? String(v.area_sq_m) : '',
        min_booking_hours:   v.min_booking_hours,
        short_description:   v.short_description ?? '',
        description:         v.description ?? '',
        cancellation_policy: v.cancellation_policy ?? '',
      })
      pendingDeleteIds.value = []
      newEditFiles.value     = []
      newEditPreviews.value.forEach(url => URL.revokeObjectURL(url))
      newEditPreviews.value  = []
      editError.value        = ''
      editOpen.value         = true
    }

    const closeEditDialog = () => {
      editOpen.value = false
      pendingDeleteIds.value = []
      newEditFiles.value     = []
      newEditPreviews.value.forEach(url => URL.revokeObjectURL(url))
      newEditPreviews.value  = []
    }

    // ── Работа с новыми фото в форме редактирования ──
    const handleEditFiles = (e: Event) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? [])
      if (!files.length) return
      newEditFiles.value    = [...newEditFiles.value, ...files]
      newEditPreviews.value = [...newEditPreviews.value, ...files.map(f => URL.createObjectURL(f))]
      ;(e.target as HTMLInputElement).value = ''
    }

    const removeEditFile = (index: number) => {
      URL.revokeObjectURL(newEditPreviews.value[index])
      newEditFiles.value    = newEditFiles.value.filter((_, i) => i !== index)
      newEditPreviews.value = newEditPreviews.value.filter((_, i) => i !== index)
    }

    // ── Отправка изменений площадки ──
    const submitEdit = async () => {
      if (!venue.value) return
      editSubmitting.value = true
      editError.value      = ''

      const payload: Record<string, any> = {
        name:                editForm.name,
        city:                editForm.city,
        postal_code:         editForm.postal_code,
        capacity_min:        editForm.capacity_min,
        capacity_max:        editForm.capacity_max,
        min_booking_hours:   editForm.min_booking_hours,
        short_description:   editForm.short_description,
        description:         editForm.description,
        cancellation_policy: editForm.cancellation_policy,
      }
      if (editForm.area_sq_m)  payload.area_sq_m  = parseFloat(editForm.area_sq_m)
      if (editForm.latitude)   payload.latitude   = parseFloat(editForm.latitude)
      if (editForm.longitude)  payload.longitude  = parseFloat(editForm.longitude)

      try {
        const venueId = venue.value.id

        // 1. Основные данные
        await $api.patch<Venue>(API_ENDPOINTS.venues.detail(venueId), payload)

        // 2. Удалить помеченные фотографии
        for (const imageId of pendingDeleteIds.value) {
          await $api.delete(API_ENDPOINTS.venues.deleteImage(venueId, imageId))
        }

        // 3. Загрузить новые фотографии
        const remainingCount = (venue.value.images ?? [])
          .filter(img => !pendingDeleteIds.value.includes(img.id)).length
        for (let i = 0; i < newEditFiles.value.length; i++) {
          const fd = new FormData()
          fd.append('image', newEditFiles.value[i])
          fd.append('order', String(remainingCount + i))
          await $api.post(API_ENDPOINTS.venues.images(venueId), fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }

        // 4. Обновить данные страницы
        venue.value = await $api.get<Venue>(API_ENDPOINTS.venues.bySlug(slug.value))

        // 5. Закрыть и очистить состояние
        editOpen.value         = false
        pendingDeleteIds.value = []
        newEditFiles.value     = []
        newEditPreviews.value.forEach(url => URL.revokeObjectURL(url))
        newEditPreviews.value  = []
      } catch (e: any) {
        if (e.data && typeof e.data === 'object' && !e.data.detail) {
          editError.value = (Object.values(e.data) as any[]).flat().join(' ')
        } else {
          editError.value = e.data?.detail || e.message || 'Ошибка при сохранении'
        }
      } finally {
        editSubmitting.value = false
      }
    }

    // ── Подтверждение удаления ──
    const confirmDelete = async () => {
      if (!venue.value) return
      deleteSubmitting.value = true
      deleteError.value      = ''
      try {
        await $api.delete(API_ENDPOINTS.venues.detail(venue.value.id))
        router.push('/dashboard')
      } catch (e: any) {
        deleteError.value = e.data?.detail || e.message || 'Ошибка при удалении'
      } finally {
        deleteSubmitting.value = false
      }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return () => {
      if (loading.value) {
        return (
          <div class="vd-loading" role="status" aria-live="polite">
            <div class="container">
              <div class="spinner" aria-hidden="true" />
              <p>Загрузка площадки...</p>
            </div>
          </div>
        )
      }

      if (error.value || !venue.value) {
        return (
          <div class="vd-error" role="alert">
            <div class="container">
              <p class="vd-error__text">{error.value ?? 'Площадка не найдена'}</p>
              <a href="/venues" class="btn btn--primary">← Все площадки</a>
            </div>
          </div>
        )
      }

      const v = venue.value

      // Кнопка бронирования в сайдбаре
      const bookBtn = !isLoggedIn.value
        ? <a href="/auth/login" class="btn btn--primary vd-book-btn">Войдите, чтобы забронировать</a>
        : !isRenter.value
          ? <p class="vd-book-role-hint">Бронирование доступно только для арендаторов</p>
          : (
            <button type="button" class="btn btn--primary vd-book-btn" onClick={openBookingDialog}>
              Забронировать
            </button>
          )

      // Панель управления для владельца
      const ownerActions = isOwner.value && (
        <div class="vd-owner-actions" aria-label="Управление площадкой">
          <h3 class="vd-owner-actions__title">Управление площадкой</h3>
          {!bookingsChecked.value ? (
            <p class="vd-owner-actions__checking">
              <span class="spinner" aria-hidden="true" />
              Проверка бронирований...
            </p>
          ) : hasActiveBookings.value ? (
            <p class="vd-owner-hint">
              Изменить или удалить площадку нельзя — по ней есть активные бронирования.
            </p>
          ) : (
            <div class="vd-owner-buttons">
              <button
                type="button"
                class="btn btn--secondary vd-owner-btn"
                onClick={openEditDialog}
              >
                Редактировать
              </button>
              <button
                type="button"
                class="vd-btn-danger vd-owner-btn"
                onClick={() => { deleteError.value = ''; deleteOpen.value = true }}
              >
                Удалить
              </button>
            </div>
          )}
        </div>
      )

      return (
        <article class="vd-page" aria-labelledby="vd-title">

          {/* ── Галерея ── */}
          {hasImages.value ? (
            <section class="vd-gallery" aria-label="Фотографии площадки">
              <div class="vd-gallery__main">
                <img
                  src={currentImage.value!.image}
                  alt={currentImage.value!.caption || `${v.name} — фото ${currentImageIndex.value + 1}`}
                  class="vd-gallery__img"
                />
                {totalImages.value > 1 && (
                  <>
                    <button
                      type="button"
                      class="vd-gallery__arrow vd-gallery__arrow--prev"
                      onClick={prevImage}
                      disabled={currentImageIndex.value === 0}
                      aria-label="Предыдущее фото"
                    >‹</button>
                    <button
                      type="button"
                      class="vd-gallery__arrow vd-gallery__arrow--next"
                      onClick={nextImage}
                      disabled={currentImageIndex.value === totalImages.value - 1}
                      aria-label="Следующее фото"
                    >›</button>
                    <div class="vd-gallery__counter" aria-live="polite" aria-atomic="true">
                      {currentImageIndex.value + 1} / {totalImages.value}
                    </div>
                  </>
                )}
              </div>
              {totalImages.value > 1 && (
                <div class="vd-gallery__thumbs" role="list" aria-label="Миниатюры фотографий">
                  {images.value.map((img, idx) => (
                    <button
                      key={img.id}
                      type="button"
                      role="listitem"
                      class={['vd-gallery__thumb', idx === currentImageIndex.value && 'vd-gallery__thumb--active']}
                      onClick={() => goToImage(idx)}
                      aria-label={img.caption || `Фото ${idx + 1}`}
                      aria-current={idx === currentImageIndex.value ? 'true' : undefined}
                    >
                      <img src={img.image} alt="" aria-hidden="true" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <div class="vd-gallery vd-gallery--empty" aria-hidden="true">
              <span class="vd-gallery__placeholder">🏛️</span>
            </div>
          )}

          <div class="container">
            <div class="vd-layout">

              {/* ── Основная колонка ── */}
              <div class="vd-main">
                <nav class="vd-breadcrumb" aria-label="Навигация">
                  <a href="/venues">Площадки</a>
                  <span aria-hidden="true"> / </span>
                  <span aria-current="page">{v.name}</span>
                </nav>

                <div class="vd-title-row">
                  <h1 id="vd-title" class="vd-title">{v.name}</h1>
                  {v.is_verified && (
                    <span class="vd-verified" title="Площадка прошла проверку">
                      <span aria-hidden="true">✓</span>
                      <span class="sr-only">Верифицировано</span>
                      Верифицировано
                    </span>
                  )}
                </div>

                <p class="vd-location">
                  <span aria-hidden="true">📍</span>
                  {v.city}{v.address ? `, ${v.address}` : ''}
                  {v.postal_code ? ` (${v.postal_code})` : ''}
                </p>

                {v.short_description && (
                  <p class="vd-short-desc">{v.short_description}</p>
                )}

                <section class="vd-section" aria-labelledby="vd-specs-title">
                  <h2 id="vd-specs-title" class="vd-section__title">Характеристики</h2>
                  <dl class="vd-specs">
                    <div class="vd-specs__item">
                      <dt>Вместимость</dt>
                      <dd>{v.capacity_min && v.capacity_max
                        ? `${v.capacity_min}–${v.capacity_max} чел.`
                        : `до ${v.capacity_max} чел.`}
                      </dd>
                    </div>
                    {v.area_sq_m && (
                      <div class="vd-specs__item">
                        <dt>Площадь</dt>
                        <dd>{v.area_sq_m} м²</dd>
                      </div>
                    )}
                    <div class="vd-specs__item">
                      <dt>Мин. аренда</dt>
                      <dd>{v.min_booking_hours} ч.</dd>
                    </div>
                    {v.latitude && v.longitude && (
                      <div class="vd-specs__item">
                        <dt>Координаты</dt>
                        <dd>
                          <a
                            href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Открыть на карте ↗
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>

                {v.description && (
                  <section class="vd-section" aria-labelledby="vd-desc-title">
                    <h2 id="vd-desc-title" class="vd-section__title">Описание</h2>
                    <div class="vd-description">
                      {v.description.split('\n').map((line, i) =>
                        line.trim() ? <p key={i}>{line}</p> : <br key={i} />,
                      )}
                    </div>
                  </section>
                )}

                {v.cancellation_policy && (
                  <section class="vd-section" aria-labelledby="vd-cancel-title">
                    <h2 id="vd-cancel-title" class="vd-section__title">Политика отмены</h2>
                    <p class="vd-cancel-policy">{v.cancellation_policy}</p>
                  </section>
                )}
              </div>

              {/* ── Боковая панель ── */}
              <aside class="vd-sidebar" aria-label="Цена и бронирование">
                <div class="vd-sidebar__card">
                  <h2 class="vd-sidebar__title">Стоимость</h2>

                  <dl class="vd-price-list">
                    {v.price_per_hour && (
                      <div class="vd-price-list__item">
                        <dt>За час</dt>
                        <dd class="vd-price-list__value">{formatCurrency(v.price_per_hour)}</dd>
                      </div>
                    )}
                    {v.price_per_day && (
                      <div class="vd-price-list__item">
                        <dt>За сутки</dt>
                        <dd class="vd-price-list__value">{formatCurrency(v.price_per_day)}</dd>
                      </div>
                    )}
                    {!v.price_per_hour && !v.price_per_day && (
                      <div class="vd-price-list__item">
                        <dd class="vd-price-list__value vd-price-list__value--na">По запросу</dd>
                      </div>
                    )}
                  </dl>

                  <p class="vd-sidebar__hint">
                    Минимальная аренда: <strong>{v.min_booking_hours} ч.</strong>
                  </p>

                  {bookBtn}
                  {ownerActions}
                </div>
              </aside>
            </div>
          </div>

          {/* ── Диалог бронирования ── */}
          <UiDialog
            open={bookingOpen.value}
            title={`Забронировать «${v.name}»`}
            size="md"
            onClose={closeBookingDialog}
          >
            {{
              default: () => (
                bookingSuccess.value ? (
                  <div class="vd-booking-success" role="status">
                    <div class="vd-booking-success__icon" aria-hidden="true">✓</div>
                    <p class="vd-booking-success__title">Бронирование создано!</p>
                    <p class="vd-booking-success__hint">
                      Заявка ожидает подтверждения владельца площадки.
                      Вы можете отслеживать статус в личном кабинете.
                    </p>
                  </div>
                ) : (
                  <form
                    id="vd-booking-form"
                    class="vd-booking-form"
                    onSubmit={(e) => { e.preventDefault(); submitBooking() }}
                    novalidate
                    aria-label="Форма бронирования площадки"
                  >
                    {submitError.value && (
                      <div class="vd-booking-form__alert">
                        <UiAlert variant="error" title="Ошибка">{submitError.value}</UiAlert>
                      </div>
                    )}

                    {eventsLoading.value ? (
                      <div class="vd-booking-form__loading" role="status">
                        <div class="spinner" aria-hidden="true" />
                        <span>Загрузка мероприятий...</span>
                      </div>
                    ) : activeEvents.value.length === 0 ? (
                      <div class="vd-booking-no-events">
                        <p class="vd-booking-no-events__text">
                          Нет подходящих мероприятий. Бронирование доступно только для
                          запланированных и активных мероприятий (не для черновиков и отменённых).
                        </p>
                        <a href="/dashboard" class="btn btn--primary btn--sm">
                          Перейти к мероприятиям
                        </a>
                      </div>
                    ) : (
                      <>
                        <UiSelect
                          id="vd-booking-event"
                          label="Мероприятие"
                          modelValue={selectedEventId.value}
                          onUpdate:modelValue={(v: any) => onEventChange(String(v))}
                          options={eventOptions.value}
                          required
                        />

                        {eventHasVenue.value && selectedEvent.value && (
                          <div class="vd-booking-form__alert">
                            <UiAlert variant="error" title="Помещение уже забронировано">
                              Для мероприятия «{selectedEvent.value.title}» уже выбрано помещение:
                              {' '}<strong>{selectedEvent.value.venues.map(ven => ven.name).join(', ')}</strong>.
                              На одно мероприятие можно забронировать только одно помещение.
                            </UiAlert>
                          </div>
                        )}

                        {selectedEventId.value && !eventHasVenue.value && (
                          <>
                            <div class="vd-booking-row">
                              <div class="input-wrapper">
                                <label class="input-label" for="vd-booking-start">
                                  Начало аренды
                                  <span class="input-required" aria-hidden="true">*</span>
                                </label>
                                <input
                                  id="vd-booking-start"
                                  type="datetime-local"
                                  class="input"
                                  value={bookingStart.value}
                                  required
                                  onInput={(e) => {
                                    bookingStart.value = (e.target as HTMLInputElement).value
                                    checkAvailability()
                                  }}
                                />
                              </div>
                              <div class="input-wrapper">
                                <label class="input-label" for="vd-booking-end">
                                  Конец аренды
                                  <span class="input-required" aria-hidden="true">*</span>
                                </label>
                                <input
                                  id="vd-booking-end"
                                  type="datetime-local"
                                  class="input"
                                  value={bookingEnd.value}
                                  required
                                  onInput={(e) => {
                                    bookingEnd.value = (e.target as HTMLInputElement).value
                                    checkAvailability()
                                  }}
                                />
                              </div>
                            </div>

                            {timeConflict.value && (
                              <div class="vd-booking-conflict" role="alert">
                                <span class="vd-booking-conflict__icon" aria-hidden="true">⚠️</span>
                                <span>
                                  Площадка уже забронирована в выбранное время.
                                  Пожалуйста, выберите другой период.
                                </span>
                              </div>
                            )}

                            {estimatedPrice.value !== null && (
                              <div class="vd-booking-estimate">
                                <span class="vd-booking-estimate__label">Примерная стоимость:</span>
                                <strong class="vd-booking-estimate__value">
                                  {formatCurrency(estimatedPrice.value)}
                                </strong>
                                <span class="vd-booking-estimate__hint">
                                  Точная сумма фиксируется при подтверждении
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </form>
                )
              ),

              footer: () => (
                bookingSuccess.value ? (
                  <>
                    <a href="/dashboard" class="btn btn--secondary">В личный кабинет</a>
                    <button type="button" class="btn btn--primary" onClick={closeBookingDialog}>
                      Закрыть
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      class="btn btn--secondary"
                      onClick={closeBookingDialog}
                      disabled={submitting.value}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      form="vd-booking-form"
                      class="btn btn--primary"
                      disabled={
                        submitting.value
                        || !selectedEventId.value
                        || eventHasVenue.value
                        || timeConflict.value
                        || !bookingStart.value
                        || !bookingEnd.value
                      }
                      aria-busy={submitting.value ? 'true' : undefined}
                    >
                      {submitting.value
                        ? <><span class="spinner" aria-hidden="true" /><span class="sr-only">Отправка</span></>
                        : 'Забронировать'}
                    </button>
                  </>
                )
              ),
            }}
          </UiDialog>

          {/* ── Диалог редактирования ── */}
          <UiDialog
            open={editOpen.value}
            title={`Редактировать «${v.name}»`}
            size="lg"
            onClose={closeEditDialog}
          >
            {{
              default: () => (
                <form
                  id="vd-edit-form"
                  class="vd-edit-form"
                  onSubmit={(e) => { e.preventDefault(); submitEdit() }}
                  novalidate
                  aria-label="Форма редактирования площадки"
                >
                  {editError.value && (
                    <UiAlert variant="error" title="Ошибка">{editError.value}</UiAlert>
                  )}

                  {/* Название */}
                  <div class="input-wrapper">
                    <label class="input-label" for="ve-name">
                      Название <span class="input-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="ve-name" type="text" class="input"
                      value={editForm.name} required
                      onInput={(e) => { editForm.name = (e.target as HTMLInputElement).value }}
                    />
                  </div>

                  {/* Город + Индекс */}
                  <div class="vd-edit-row-2">
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-city">
                        Город <span class="input-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="ve-city" type="text" class="input"
                        value={editForm.city} required
                        onInput={(e) => { editForm.city = (e.target as HTMLInputElement).value }}
                      />
                    </div>
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-postal">Почтовый индекс</label>
                      <input
                        id="ve-postal" type="text" class="input"
                        value={editForm.postal_code}
                        onInput={(e) => { editForm.postal_code = (e.target as HTMLInputElement).value }}
                      />
                    </div>
                  </div>

                  {/* Вместимость */}
                  <div class="vd-edit-row-2">
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-cap-min">Вместимость (мин.)</label>
                      <input
                        id="ve-cap-min" type="number" class="input" min="1"
                        value={editForm.capacity_min}
                        onInput={(e) => { editForm.capacity_min = parseInt((e.target as HTMLInputElement).value) || 1 }}
                      />
                    </div>
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-cap-max">Вместимость (макс.)</label>
                      <input
                        id="ve-cap-max" type="number" class="input" min="1"
                        value={editForm.capacity_max}
                        onInput={(e) => { editForm.capacity_max = parseInt((e.target as HTMLInputElement).value) || 1 }}
                      />
                    </div>
                  </div>

                  {/* Площадь + Мин. аренда */}
                  <div class="vd-edit-row-2">
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-area">Площадь (м²)</label>
                      <input
                        id="ve-area" type="number" class="input" min="1" placeholder="Не указана"
                        value={editForm.area_sq_m}
                        onInput={(e) => { editForm.area_sq_m = (e.target as HTMLInputElement).value }}
                      />
                    </div>
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-min-hours">Мин. часов аренды</label>
                      <input
                        id="ve-min-hours" type="number" class="input" min="1"
                        value={editForm.min_booking_hours}
                        onInput={(e) => { editForm.min_booking_hours = parseInt((e.target as HTMLInputElement).value) || 1 }}
                      />
                    </div>
                  </div>

                  {/* Координаты */}
                  <div class="vd-edit-row-2">
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-lat">Широта</label>
                      <input
                        id="ve-lat" type="number" class="input" step="any" placeholder="55.7558"
                        value={editForm.latitude}
                        onInput={(e) => { editForm.latitude = (e.target as HTMLInputElement).value }}
                      />
                    </div>
                    <div class="input-wrapper">
                      <label class="input-label" for="ve-lng">Долгота</label>
                      <input
                        id="ve-lng" type="number" class="input" step="any" placeholder="37.6173"
                        value={editForm.longitude}
                        onInput={(e) => { editForm.longitude = (e.target as HTMLInputElement).value }}
                      />
                    </div>
                  </div>

                  {/* Краткое описание */}
                  <div class="input-wrapper">
                    <label class="input-label" for="ve-short-desc">
                      Краткое описание
                      <span class="vf-hint-inline">({editForm.short_description.length}/300)</span>
                    </label>
                    <textarea
                      id="ve-short-desc" class="input vd-edit-textarea" rows={2} maxlength={300}
                      value={editForm.short_description}
                      onInput={(e) => { editForm.short_description = (e.target as HTMLTextAreaElement).value }}
                    />
                  </div>

                  {/* Полное описание */}
                  <div class="input-wrapper">
                    <label class="input-label" for="ve-desc">Полное описание</label>
                    <textarea
                      id="ve-desc" class="input vd-edit-textarea" rows={4}
                      value={editForm.description}
                      onInput={(e) => { editForm.description = (e.target as HTMLTextAreaElement).value }}
                    />
                  </div>

                  {/* Политика отмены */}
                  <div class="input-wrapper">
                    <label class="input-label" for="ve-cancel">Политика отмены</label>
                    <textarea
                      id="ve-cancel" class="input vd-edit-textarea" rows={3}
                      value={editForm.cancellation_policy}
                      onInput={(e) => { editForm.cancellation_policy = (e.target as HTMLTextAreaElement).value }}
                    />
                  </div>

                  {/* Фотографии */}
                  <div class="input-wrapper">
                    <span class="input-label">Фотографии</span>

                    {/* Текущие фото */}
                    {(v.images ?? []).filter(img => !pendingDeleteIds.value.includes(img.id)).length > 0 && (
                      <div class="vcf__photo-grid vd-edit-photo-section">
                        {(v.images ?? [])
                          .filter(img => !pendingDeleteIds.value.includes(img.id))
                          .map(img => (
                            <div key={img.id} class="vcf__photo-item">
                              <img src={img.image} alt="" class="vcf__photo-img" loading="lazy" />
                              <button
                                type="button"
                                class="vcf__photo-remove"
                                aria-label="Удалить фото"
                                onClick={() => { pendingDeleteIds.value = [...pendingDeleteIds.value, img.id] }}
                              >✕</button>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Превью новых фото */}
                    {newEditPreviews.value.length > 0 && (
                      <div class="vcf__photo-grid vd-edit-photo-section">
                        {newEditPreviews.value.map((url, i) => (
                          <div key={url} class="vcf__photo-item">
                            <img src={url} alt="" class="vcf__photo-img" />
                            <button
                              type="button"
                              class="vcf__photo-remove"
                              aria-label="Убрать фото"
                              onClick={() => removeEditFile(i)}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Загрузка новых фото */}
                    <label for="ve-photos" class="vcf__file-label">
                      <span aria-hidden="true">📁</span> Добавить фотографии
                    </label>
                    <input
                      id="ve-photos"
                      type="file"
                      class="vcf__file-input"
                      multiple
                      accept="image/*"
                      aria-label="Добавить фотографии площадки"
                      onChange={handleEditFiles}
                    />
                  </div>
                </form>
              ),

              footer: () => (
                <>
                  <button
                    type="button" class="btn btn--secondary"
                    onClick={closeEditDialog}
                    disabled={editSubmitting.value}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit" form="vd-edit-form" class="btn btn--primary"
                    disabled={editSubmitting.value}
                    aria-busy={editSubmitting.value ? 'true' : undefined}
                  >
                    {editSubmitting.value
                      ? <><span class="spinner" aria-hidden="true" /><span class="sr-only">Сохранение</span></>
                      : 'Сохранить'}
                  </button>
                </>
              ),
            }}
          </UiDialog>

          {/* ── Диалог подтверждения удаления ── */}
          <UiDialog
            open={deleteOpen.value}
            title="Удалить площадку"
            size="sm"
            onClose={() => { deleteOpen.value = false }}
          >
            {{
              default: () => (
                <div class="vd-delete-body">
                  {deleteError.value && (
                    <UiAlert variant="error" title="Ошибка">{deleteError.value}</UiAlert>
                  )}
                  <p class="vd-delete-text">
                    Вы уверены, что хотите удалить площадку{' '}
                    <strong>«{v.name}»</strong>?{' '}
                    Это действие невозможно отменить.
                  </p>
                </div>
              ),

              footer: () => (
                <>
                  <button
                    type="button" class="btn btn--secondary"
                    onClick={() => { deleteOpen.value = false }}
                    disabled={deleteSubmitting.value}
                  >
                    Отмена
                  </button>
                  <button
                    type="button" class="vd-btn-danger"
                    onClick={confirmDelete}
                    disabled={deleteSubmitting.value}
                    aria-busy={deleteSubmitting.value ? 'true' : undefined}
                  >
                    {deleteSubmitting.value
                      ? <><span class="spinner" aria-hidden="true" /><span class="sr-only">Удаление</span></>
                      : 'Удалить'}
                  </button>
                </>
              ),
            }}
          </UiDialog>

        </article>
      )
    }
  },
})
