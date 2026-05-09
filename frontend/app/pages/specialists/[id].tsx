import { defineComponent, ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useUserStore } from '~/stores/user'
import { API_ENDPOINTS } from '~/utils/constants'
import type { SpecialistDetail, Event, SpecialistBusySlot } from '~/utils/types'
import UiDialog from '~/components/ui/Dialog'
import UiSelect from '~/components/ui/Select'
import UiAlert from '~/components/ui/Alert'

export default defineComponent({
  name: 'SpecialistDetailPage',
  setup() {
    const route = useRoute()
    const $api = useApi()
    const userStore = useUserStore()

    // ── Данные специалиста ──
    const specialist = ref<SpecialistDetail | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)

    const id = computed(() => route.params.id as string)

    // ── Пользователь ──
    const isLoggedIn = computed(() => !!userStore.user)
    const isRenter   = computed(() => userStore.user?.role === 'renter')

    // ── Диалог найма ──
    const hireOpen     = ref(false)
    const myEvents     = ref<Event[]>([])
    const eventsLoading = ref(false)
    const selectedEventId = ref('')
    const selectedEvent = ref<Event | null>(null)
    const hireStart    = ref('')
    const hireEnd      = ref('')
    const timeConflict = ref(false)
    const submitting   = ref(false)
    const submitError  = ref('')
    const hireSuccess  = ref(false)

    // ── Форматирование ──
    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const formatRating = (rating: string): string => {
      const n = parseFloat(rating)
      return isNaN(n) || n === 0 ? '—' : n.toFixed(1)
    }

    const ratingStars = (rating: string) => {
      const n = parseFloat(rating)
      if (isNaN(n) || n === 0) return { filled: 0, empty: 0 }
      const filled = Math.min(5, Math.round(n))
      return { filled, empty: 5 - filled }
    }

    // ── Загрузка специалиста ──
    onMounted(async () => {
      try {
        specialist.value = await $api.get<SpecialistDetail>(
          API_ENDPOINTS.specialists.detail(id.value),
        )
      } catch (e: any) {
        error.value = e.statusCode === 404
          ? 'Специалист не найден.'
          : e.message || 'Ошибка загрузки данных'
      } finally {
        loading.value = false
      }
    })

    // ── Активные мероприятия для селектора ──
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

    // ── Открыть диалог ──
    const openHireDialog = async () => {
      selectedEventId.value = ''
      selectedEvent.value   = null
      hireStart.value       = ''
      hireEnd.value         = ''
      timeConflict.value    = false
      submitError.value     = ''
      hireSuccess.value     = false
      hireOpen.value        = true

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

    const closeHireDialog = () => { hireOpen.value = false }

    // ── Проверка доступности специалиста ──
    const checkAvailability = async () => {
      if (!hireStart.value || !hireEnd.value) return
      timeConflict.value = false
      try {
        const date = hireStart.value.split('T')[0]
        const res = await $api.get<{ busy_slots: SpecialistBusySlot[] }>(
          API_ENDPOINTS.hires.specialistAvailability(id.value),
          { params: { from: `${date}T00:00:00`, to: `${date}T23:59:59` } },
        )
        const reqStart = new Date(hireStart.value).getTime()
        const reqEnd   = new Date(hireEnd.value).getTime()
        timeConflict.value = res.busy_slots.some(slot => {
          const s = new Date(slot.start_datetime).getTime()
          const e = new Date(slot.end_datetime).getTime()
          return reqStart < e && reqEnd > s
        })
      } catch {
        /* игнорируем — бэкенд проверит при создании */
      }
    }

    // ── Выбор мероприятия ──
    const onEventChange = async (eventId: string) => {
      selectedEventId.value = eventId
      selectedEvent.value   = null
      timeConflict.value    = false
      hireStart.value       = ''
      hireEnd.value         = ''
      if (!eventId) return

      try {
        const ev = await $api.get<Event>(API_ENDPOINTS.events.detail(eventId))
        selectedEvent.value = ev

        // Предзаполнение дат из мероприятия
        const date      = ev.date
        const startTime = ev.start_time?.slice(0, 5) ?? '10:00'
        const endTime   = ev.end_time?.slice(0, 5) ?? ''

        hireStart.value = `${date}T${startTime}`

        if (endTime) {
          hireEnd.value = `${date}T${endTime}`
        } else {
          const [hh, mm] = startTime.split(':').map(Number)
          const endH = String((hh + 2) % 24).padStart(2, '0')
          hireEnd.value = `${date}T${endH}:${String(mm).padStart(2, '0')}`
        }

        await checkAvailability()
      } catch {
        /* ignore */
      }
    }

    // ── Отправка найма ──
    const submitHire = async () => {
      if (!selectedEventId.value || !hireStart.value || !hireEnd.value) return
      submitting.value  = true
      submitError.value = ''
      try {
        const toISO = (s: string) => s.length === 16 ? `${s}:00` : s
        await $api.post(API_ENDPOINTS.hires.list, {
          specialist:     id.value,  // user UUID — бэкенд теперь принимает его
          event:          selectedEventId.value,
          start_datetime: toISO(hireStart.value),
          end_datetime:   toISO(hireEnd.value),
        })
        hireSuccess.value = true
      } catch (e: any) {
        if (e.data && typeof e.data === 'object' && !e.data.detail) {
          submitError.value = (Object.values(e.data) as any[]).flat().join(' ')
        } else {
          submitError.value = e.data?.detail || e.message || 'Ошибка при создании найма'
        }
      } finally {
        submitting.value = false
      }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return () => {
      if (loading.value) {
        return (
          <div class="sd-loading" role="status" aria-live="polite">
            <div class="container">
              <div class="spinner" aria-hidden="true" />
              <p>Загрузка профиля...</p>
            </div>
          </div>
        )
      }

      if (error.value || !specialist.value) {
        return (
          <div class="sd-error" role="alert">
            <div class="container">
              <p class="sd-error__text">{error.value ?? 'Специалист не найден'}</p>
              <a href="/specialists" class="btn btn--primary">← Все специалисты</a>
            </div>
          </div>
        )
      }

      const s = specialist.value
      const fullName = `${s.first_name} ${s.last_name}`.trim() || 'Специалист'
      const initials = ((s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')).toUpperCase() || '?'
      const stars    = ratingStars(s.rating)
      const hasRating = parseFloat(s.rating) > 0

      // Кнопка найма
      const hireBtn = (extraClass = '') => (
        !isLoggedIn.value
          ? <a href="/auth/login" class={`btn btn--primary ${extraClass}`}>Войдите, чтобы нанять</a>
          : !isRenter.value
            ? <p class="sd-hire-role-hint">Найм доступен только для арендаторов</p>
            : (
              <button type="button" class={`btn btn--primary ${extraClass}`} onClick={openHireDialog}>
                Нанять специалиста
              </button>
            )
      )

      return (
        <article class="sd-page" aria-labelledby="sd-name">
          <div class="container">
            <nav class="sd-breadcrumb" aria-label="Навигация">
              <a href="/specialists">Специалисты</a>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{fullName}</span>
            </nav>

            <div class="sd-layout">
              {/* ── Карточка профиля ── */}
              <aside class="sd-profile-card" aria-label="Профиль специалиста">
                <div class="sd-avatar" aria-hidden="true">
                  {s.avatar
                    ? <img src={s.avatar} alt={`Фото специалиста ${fullName}`} class="sd-avatar__img" />
                    : <span class="sd-avatar__initials">{initials}</span>
                  }
                </div>

                <h1 id="sd-name" class="sd-name">{fullName}</h1>

                {s.specialty && <p class="sd-specialty">{s.specialty}</p>}
                {s.city && (
                  <p class="sd-city"><span aria-hidden="true">📍</span> {s.city}</p>
                )}

                {hasRating && (
                  <div class="sd-rating" aria-label={`Рейтинг: ${formatRating(s.rating)} из 5`}>
                    <span class="sd-rating__stars" aria-hidden="true">
                      {'★'.repeat(stars.filled)}{'☆'.repeat(stars.empty)}
                    </span>
                    <span class="sd-rating__value">{formatRating(s.rating)}</span>
                    <span class="sd-rating__max" aria-hidden="true">/ 5</span>
                  </div>
                )}

                {hireBtn('sd-hire-btn')}
              </aside>

              {/* ── Основная колонка ── */}
              <div class="sd-main">
                <section class="sd-section" aria-labelledby="sd-info-title">
                  <h2 id="sd-info-title" class="sd-section__title">О специалисте</h2>
                  <dl class="sd-info">
                    {s.specialty && (
                      <div class="sd-info__row">
                        <dt>Специализация</dt>
                        <dd>{s.specialty}</dd>
                      </div>
                    )}
                    {s.city && (
                      <div class="sd-info__row">
                        <dt>Город</dt>
                        <dd>{s.city}</dd>
                      </div>
                    )}
                    {s.license_number && (
                      <div class="sd-info__row">
                        <dt>Номер лицензии</dt>
                        <dd>{s.license_number}</dd>
                      </div>
                    )}
                    {hasRating && (
                      <div class="sd-info__row">
                        <dt>Рейтинг</dt>
                        <dd>
                          <span aria-hidden="true">
                            {'★'.repeat(stars.filled)}{'☆'.repeat(stars.empty)}{' '}
                          </span>
                          {formatRating(s.rating)} из 5
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>

                {s.portfolio_url && (
                  <section class="sd-section" aria-labelledby="sd-portfolio-title">
                    <h2 id="sd-portfolio-title" class="sd-section__title">Портфолио</h2>
                    <a
                      href={s.portfolio_url}
                      class="sd-portfolio-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Портфолио специалиста ${fullName} (откроется в новой вкладке)`}
                    >
                      <span aria-hidden="true">🔗</span>
                      Посмотреть работы ↗
                    </a>
                  </section>
                )}

                <section class="sd-section sd-hire-section" aria-labelledby="sd-hire-title">
                  <h2 id="sd-hire-title" class="sd-section__title">Нанять для мероприятия</h2>
                  <p class="sd-hire-desc">
                    Пригласите специалиста на своё мероприятие. Укажите период работы —
                    специалист рассмотрит заявку в течение суток.
                  </p>
                  {hireBtn('sd-hire-btn-main')}
                </section>
              </div>
            </div>
          </div>

          {/* ── Диалог найма ── */}
          <UiDialog
            open={hireOpen.value}
            title={`Нанять «${fullName}»`}
            size="md"
            onClose={closeHireDialog}
          >
            {{
              default: () => (
                hireSuccess.value ? (
                  <div class="sd-hire-success" role="status">
                    <div class="sd-hire-success__icon" aria-hidden="true">✓</div>
                    <p class="sd-hire-success__title">Заявка отправлена!</p>
                    <p class="sd-hire-success__hint">
                      Специалист рассмотрит заявку и подтвердит найм.
                      Статус можно отследить в личном кабинете.
                    </p>
                  </div>
                ) : (
                  <form
                    id="sd-hire-form"
                    class="sd-hire-form"
                    onSubmit={(e) => { e.preventDefault(); submitHire() }}
                    novalidate
                    aria-label="Форма найма специалиста"
                  >
                    {submitError.value && (
                      <div class="sd-hire-form__alert">
                        <UiAlert variant="error" title="Ошибка">{submitError.value}</UiAlert>
                      </div>
                    )}

                    {eventsLoading.value ? (
                      <div class="sd-hire-form__loading" role="status">
                        <div class="spinner" aria-hidden="true" />
                        <span>Загрузка мероприятий...</span>
                      </div>
                    ) : activeEvents.value.length === 0 ? (
                      <div class="sd-hire-no-events">
                        <p class="sd-hire-no-events__text">
                          Нет подходящих мероприятий. Найм доступен только для
                          запланированных и активных мероприятий (не для черновиков и отменённых).
                        </p>
                        <a href="/dashboard" class="btn btn--primary btn--sm">
                          Перейти к мероприятиям
                        </a>
                      </div>
                    ) : (
                      <>
                        <UiSelect
                          id="sd-hire-event"
                          label="Мероприятие"
                          modelValue={selectedEventId.value}
                          onUpdate:modelValue={(v: any) => onEventChange(String(v))}
                          options={eventOptions.value}
                          required
                        />

                        {selectedEventId.value && (
                          <>
                            <div class="sd-hire-row">
                              <div class="input-wrapper">
                                <label class="input-label" for="sd-hire-start">
                                  Начало работы
                                  <span class="input-required" aria-hidden="true">*</span>
                                </label>
                                <input
                                  id="sd-hire-start"
                                  type="datetime-local"
                                  class="input"
                                  value={hireStart.value}
                                  required
                                  onInput={(e) => {
                                    hireStart.value = (e.target as HTMLInputElement).value
                                    checkAvailability()
                                  }}
                                />
                              </div>

                              <div class="input-wrapper">
                                <label class="input-label" for="sd-hire-end">
                                  Конец работы
                                  <span class="input-required" aria-hidden="true">*</span>
                                </label>
                                <input
                                  id="sd-hire-end"
                                  type="datetime-local"
                                  class="input"
                                  value={hireEnd.value}
                                  required
                                  onInput={(e) => {
                                    hireEnd.value = (e.target as HTMLInputElement).value
                                    checkAvailability()
                                  }}
                                />
                              </div>
                            </div>

                            {timeConflict.value && (
                              <div class="sd-hire-conflict" role="alert">
                                <span class="sd-hire-conflict__icon" aria-hidden="true">⚠️</span>
                                <span>
                                  Специалист уже занят в выбранное время.
                                  Пожалуйста, выберите другой период.
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
                hireSuccess.value ? (
                  <>
                    <a href="/dashboard" class="btn btn--secondary">В личный кабинет</a>
                    <button type="button" class="btn btn--primary" onClick={closeHireDialog}>
                      Закрыть
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      class="btn btn--secondary"
                      onClick={closeHireDialog}
                      disabled={submitting.value}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      form="sd-hire-form"
                      class="btn btn--primary"
                      disabled={
                        submitting.value
                        || !selectedEventId.value
                        || timeConflict.value
                        || !hireStart.value
                        || !hireEnd.value
                      }
                      aria-busy={submitting.value ? 'true' : undefined}
                    >
                      {submitting.value
                        ? <><span class="spinner" aria-hidden="true" /><span class="sr-only">Отправка</span></>
                        : 'Нанять специалиста'}
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
