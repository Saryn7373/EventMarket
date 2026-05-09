import { defineComponent, ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useUserStore } from '~/stores/user'
import { API_ENDPOINTS } from '~/utils/constants'
import type { Venue, Event, BusySlot } from '~/utils/types'
import UiDialog from '~/components/ui/Dialog'
import UiSelect from '~/components/ui/Select'
import UiAlert from '~/components/ui/Alert'

export default defineComponent({
  name: 'VenueDetailPage',
  setup() {
    const route = useRoute()
    const $api = useApi()
    const userStore = useUserStore()

    // ── Данные площадки ──
    const venue = ref<Venue | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)
    const currentImageIndex = ref(0)

    const slug = computed(() => route.params.slug as string)
    const images = computed(() => venue.value?.images ?? [])
    const hasImages = computed(() => images.value.length > 0)
    const currentImage = computed(() => images.value[currentImageIndex.value] ?? null)
    const totalImages = computed(() => images.value.length)

    const prevImage = () => { if (currentImageIndex.value > 0) currentImageIndex.value-- }
    const nextImage = () => { if (currentImageIndex.value < totalImages.value - 1) currentImageIndex.value++ }
    const goToImage = (idx: number) => { currentImageIndex.value = idx }

    // ── Пользователь ──
    const isLoggedIn = computed(() => !!userStore.user)
    const isRenter   = computed(() => userStore.user?.role === 'renter')

    // ── Диалог бронирования ──
    const bookingOpen    = ref(false)
    const myEvents       = ref<Event[]>([])
    const eventsLoading  = ref(false)
    const selectedEventId = ref('')
    const selectedEvent  = ref<Event | null>(null)
    const bookingStart   = ref('')
    const bookingEnd     = ref('')
    const timeConflict   = ref(false)
    const eventHasVenue  = ref(false)
    const submitting     = ref(false)
    const submitError    = ref('')
    const bookingSuccess = ref(false)

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

    // ── Открыть диалог ──
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

        // Одно помещение на мероприятие
        eventHasVenue.value = ev.venues.length > 0

        if (!eventHasVenue.value) {
          // Предзаполнение дат из мероприятия
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
                        {/* Выбор мероприятия */}
                        <UiSelect
                          id="vd-booking-event"
                          label="Мероприятие"
                          modelValue={selectedEventId.value}
                          onUpdate:modelValue={(v: any) => onEventChange(String(v))}
                          options={eventOptions.value}
                          required
                        />

                        {/* Блокирующий алерт: помещение уже есть */}
                        {eventHasVenue.value && selectedEvent.value && (
                          <div class="vd-booking-form__alert">
                            <UiAlert variant="error" title="Помещение уже забронировано">
                              Для мероприятия «{selectedEvent.value.title}» уже выбрано помещение:
                              {' '}<strong>{selectedEvent.value.venues.map(ven => ven.name).join(', ')}</strong>.
                              На одно мероприятие можно забронировать только одно помещение.
                            </UiAlert>
                          </div>
                        )}

                        {/* Дата и время (только если нет конфликта с event.venues) */}
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

                            {/* Предупреждение о занятости */}
                            {timeConflict.value && (
                              <div class="vd-booking-conflict" role="alert">
                                <span class="vd-booking-conflict__icon" aria-hidden="true">⚠️</span>
                                <span>
                                  Площадка уже забронирована в выбранное время.
                                  Пожалуйста, выберите другой период.
                                </span>
                              </div>
                            )}

                            {/* Примерная стоимость */}
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
        </article>
      )
    }
  },
})
