import { defineComponent, ref, reactive, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useApi } from '~/composables/useApi'
import {
  API_ENDPOINTS,
  EVENT_THEMES,
  EVENT_THEME_ICONS,
  EVENT_STATUS,
} from '~/utils/constants'
import type { Event, EventTheme, EventStatus } from '~/utils/types'
import UiDialog from '~/components/ui/Dialog'
import UiInput from '~/components/ui/Input'
import UiSelect from '~/components/ui/Select'
import UiAlert from '~/components/ui/Alert'

definePageMeta({ middleware: 'auth' })

// ─── Цвета статусов ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f3f4f6', color: '#374151' },
  planned: { bg: '#fef3c7', color: '#92400e' },
  active: { bg: '#dbeafe', color: '#1e40af' },
  ongoing: { bg: '#dcfce7', color: '#14532d' },
  completed: { bg: '#dcfce7', color: '#14532d' },
  cancelled: { bg: '#fee2e2', color: '#7f1d1d' },
}

// Допустимые переходы статусов (текущий включён)
const ALLOWED_NEXT: Record<string, EventStatus[]> = {
  draft: ['draft', 'planned', 'cancelled'],
  planned: ['planned', 'active', 'cancelled'],
  active: ['active', 'ongoing', 'cancelled'],
  ongoing: ['ongoing', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled', 'draft'],
}

// ─── Форма редактирования ─────────────────────────────────────────────────────

interface EditForm {
  title: string
  theme: EventTheme | ''
  status: EventStatus | ''
  short_description: string
  description: string
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default defineComponent({
  name: 'EventDetailPage',
  setup() {
    const route = useRoute()
    const $api = useApi()

    // ── Данные страницы ──
    const event = ref<Event | null>(null)
    const loading = ref(true)
    const pageError = ref<string | null>(null)
    const id = computed(() => route.params.id as string)

    // ── Диалог отмены ──
    const cancelOpen = ref(false)
    const cancelling = ref(false)
    const cancelError = ref('')

    // ── Диалог редактирования ──
    const editOpen = ref(false)
    const editForm = reactive<EditForm>({
      title: '', theme: '', status: '',
      short_description: '', description: '',
    })
    const editErrors = ref<Record<string, string>>({})
    const editSubmitting = ref(false)
    const editError = ref('')

    // ── Computed ──
    const statusStyle = computed(() => STATUS_STYLES[event.value?.status ?? ''] ?? STATUS_STYLES.draft)

    const statusLabel = computed(() =>
      event.value
        ? (event.value.status_display ?? EVENT_STATUS[event.value.status] ?? event.value.status)
        : '',
    )

    const themeLabel = computed(() =>
      event.value
        ? (event.value.theme_display ?? EVENT_THEMES[event.value.theme] ?? event.value.theme)
        : '',
    )

    const themeIcon = computed(() => EVENT_THEME_ICONS[event.value?.theme ?? 'other'] ?? '📌')

    // Мероприятие можно отменить из любого статуса, кроме уже завершённых/отменённых
    const canCancel = computed(() =>
      !!event.value && !['completed', 'cancelled'].includes(event.value.status),
    )

    const shortDescLen = computed(() => editForm.short_description.length)

    const themeOptions = computed(() =>
      Object.entries(EVENT_THEMES).map(([v, l]) => ({
        value: v,
        label: `${EVENT_THEME_ICONS[v as EventTheme] ?? '📌'} ${l}`,
      })),
    )

    const statusOptions = computed(() => {
      const allowed = ALLOWED_NEXT[event.value?.status ?? 'draft'] ?? []
      return allowed.map((s) => ({
        value: s,
        label: EVENT_STATUS[s] ?? s,
      }))
    })

    // ── Форматирование ──
    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

    const formatTime = (t: string | null) => t?.slice(0, 5) ?? ''

    // ── Загрузка мероприятия ──
    onMounted(async () => {
      try {
        event.value = await $api.get<Event>(API_ENDPOINTS.events.detail(id.value))
      } catch (e: any) {
        pageError.value =
          e.statusCode === 404 ? 'Мероприятие не найдено.' :
            e.statusCode === 403 ? 'У вас нет доступа к этому мероприятию.' :
              e.message || 'Ошибка загрузки данных'
      } finally {
        loading.value = false
      }
    })

    // ── Диалог: открыть / закрыть ──
    const openEdit = () => {
      if (!event.value) return
      const ev = event.value
      editForm.title = ev.title
      editForm.theme = ev.theme
      editForm.status = ev.status
      editForm.short_description = ev.short_description ?? ''
      editForm.description = ev.description ?? ''
      editErrors.value = {}
      editError.value = ''
      editOpen.value = true
    }

    const closeEdit = () => { editOpen.value = false }

    // ── Отмена мероприятия ──
    const openCancel = () => {
      cancelError.value = ''
      cancelOpen.value = true
    }

    const closeCancel = () => { cancelOpen.value = false }

    const confirmCancel = async () => {
      cancelling.value = true
      cancelError.value = ''
      try {
        const updated = await $api.patch<Event>(
          API_ENDPOINTS.events.status(id.value),
          { status: 'cancelled' },
        )
        event.value = updated
        cancelOpen.value = false
      } catch (e: any) {
        cancelError.value = e.data?.detail || e.data?.status?.[0] || e.message || 'Ошибка при отмене'
      } finally {
        cancelling.value = false
      }
    }

    // ── Валидация ──
    const validate = (): boolean => {
      const errs: Record<string, string> = {}
      if (!editForm.title.trim()) errs.title = 'Название обязательно'
      if (editForm.title.length > 200) errs.title = 'Не более 200 символов'
      if (!editForm.theme) errs.theme = 'Выберите тематику'
      if (!editForm.status) errs.status = 'Выберите статус'
      if (editForm.short_description.length > 300)
        errs.short_description = 'Не более 300 символов'
      editErrors.value = errs
      return Object.keys(errs).length === 0
    }

    // ── Сохранение ──
    const submitEdit = async () => {
      if (!validate()) return
      editSubmitting.value = true
      editError.value = ''

      try {
        const payload: Record<string, any> = {
          title: editForm.title.trim(),
          theme: editForm.theme,
          status: editForm.status,
          short_description: editForm.short_description.trim(),
          description: editForm.description.trim(),
        }

        const updated = await $api.patch<Event>(
          API_ENDPOINTS.events.detail(id.value),
          payload,
        )
        event.value = updated
        closeEdit()
      } catch (e: any) {
        if (e.data && typeof e.data === 'object' && !e.data.detail) {
          const serverErrs: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(e.data))
            serverErrs[field] = Array.isArray(msgs) ? (msgs as string[])[0] : String(msgs)
          editErrors.value = { ...editErrors.value, ...serverErrs }
        } else {
          editError.value = e.data?.detail || e.message || 'Ошибка при сохранении'
        }
      } finally {
        editSubmitting.value = false
      }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return () => {
      if (loading.value) {
        return (
          <div class="ep-loading" role="status" aria-live="polite">
            <div class="container">
              <div class="spinner" aria-hidden="true" />
              <p>Загрузка мероприятия...</p>
            </div>
          </div>
        )
      }

      if (pageError.value || !event.value) {
        return (
          <div class="ep-error" role="alert">
            <div class="container">
              <p class="ep-error__text">{pageError.value ?? 'Мероприятие не найдено'}</p>
              <RouterLink to="/dashboard" class="btn btn--primary">← Вернуться в дашборд</RouterLink>
            </div>
          </div>
        )
      }

      const ev = event.value
      const hasVenues = ev.venues.length > 0
      const hasSpecialists = ev.specialists.length > 0

      return (
        <article class="ep-page" aria-labelledby="ep-title">
          <div class="container">

            {/* Хлебные крошки */}
            <nav class="ep-breadcrumb" aria-label="Навигация">
              <RouterLink to="/dashboard">Дашборд</RouterLink>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{ev.title}</span>
            </nav>

            {/* ── Шапка ── */}
            <header class="ep-header">
              <div class="ep-header__top">
                <span class="ep-theme-icon" aria-hidden="true">{themeIcon.value}</span>
                <h1 id="ep-title" class="ep-title">{ev.title}</h1>
                <span
                  class="ep-status"
                  style={statusStyle.value}
                  aria-label={`Статус: ${statusLabel.value}`}
                >
                  {statusLabel.value}
                </span>
                <div class="ep-header__actions">
                  {ev.status !== 'cancelled' && (
                    <button
                      type="button"
                      class="btn btn--secondary btn--sm"
                      onClick={openEdit}
                      aria-label="Редактировать основную информацию мероприятия"
                    >
                      Редактировать
                    </button>
                  )}
                  {canCancel.value && (
                    <button
                      type="button"
                      class="btn btn--danger btn--sm"
                      onClick={openCancel}
                      aria-label="Отменить мероприятие"
                    >
                      Отменить мероприятие
                    </button>
                  )}
                </div>
              </div>

              <dl class="ep-meta">
                <div class="ep-meta__item">
                  <dt>Дата</dt>
                  <dd>
                    {ev.is_today && <span class="ep-badge ep-badge--today">Сегодня</span>}
                    {ev.is_upcoming && !ev.is_today && <span class="ep-badge ep-badge--upcoming">Предстоит</span>}
                    {formatDate(ev.date)}
                  </dd>
                </div>

                {(ev.start_time || ev.end_time) && (
                  <div class="ep-meta__item">
                    <dt>Время</dt>
                    <dd>
                      {ev.start_time ? formatTime(ev.start_time) : '—'}
                      {ev.end_time ? ` — ${formatTime(ev.end_time)}` : ''}
                      {ev.duration_hours ? ` (${ev.duration_hours} ч.)` : ''}
                    </dd>
                  </div>
                )}

                <div class="ep-meta__item">
                  <dt>Тематика</dt>
                  <dd>{themeLabel.value}</dd>
                </div>

                <div class="ep-meta__item">
                  <dt>Гостей</dt>
                  <dd>{ev.expected_guests} чел.</dd>
                </div>
              </dl>

              {ev.short_description && (
                <p class="ep-short-desc">{ev.short_description}</p>
              )}
            </header>

            {/* ── Площадки и специалисты ── */}
            <div class="ep-body">

              {/* Площадки */}
              <section class="ep-section" aria-labelledby="ep-venues-title">
                <div class="ep-section__header">
                  <h2 id="ep-venues-title" class="ep-section__title">
                    Площадки
                    {hasVenues && (
                      <span class="ep-section__count" aria-label={`${ev.venues.length} площадок`}>
                        {ev.venues.length}
                      </span>
                    )}
                  </h2>
                </div>

                {hasVenues ? (
                  <ul class="ep-cards" aria-label="Забронированные площадки">
                    {ev.venues.map((v) => (
                      <li key={v.id}>
                        <RouterLink
                          to={`/venues/${v.slug}`}
                          class="ep-venue-card"
                          aria-label={`Площадка ${v.name}, ${v.city}`}
                        >
                          <div class="ep-venue-card__icon" aria-hidden="true">🏛️</div>
                          <div class="ep-venue-card__body">
                            <strong class="ep-venue-card__name">{v.name}</strong>
                            <span class="ep-venue-card__location">
                              {v.city}{v.address ? `, ${v.address}` : ''}
                            </span>
                          </div>
                          <span class="ep-venue-card__arrow" aria-hidden="true">→</span>
                        </RouterLink>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div class="ep-empty">
                    <span class="ep-empty__icon" aria-hidden="true">🏛️</span>
                    <p class="ep-empty__text">Площадки ещё не забронированы</p>
                    {!['draft', 'cancelled', 'completed'].includes(ev.status) && (
                      <RouterLink
                        to={{
                          path: '/venues',
                          query: {
                            date: ev.date,
                            ...(ev.expected_guests ? { guests: String(ev.expected_guests) } : {}),
                            ...(ev.start_time ? { time_from: ev.start_time.slice(0, 5) } : {}),
                            ...(ev.end_time ? { time_to: ev.end_time.slice(0, 5) } : {}),
                          },
                        }}
                        class="btn btn--primary"
                      >
                        Забронировать помещение
                      </RouterLink>
                    )}
                  </div>
                )}
              </section>

              {/* Специалисты */}
              <section class="ep-section" aria-labelledby="ep-specialists-title">
                <div class="ep-section__header">
                  <h2 id="ep-specialists-title" class="ep-section__title">
                    Специалисты
                    {hasSpecialists && (
                      <span class="ep-section__count" aria-label={`${ev.specialists.length} специалистов`}>
                        {ev.specialists.length}
                      </span>
                    )}
                  </h2>
                  {!['draft', 'cancelled', 'completed'].includes(ev.status) && (
                    <RouterLink
                      to={{
                        path: '/specialists',
                        query: {
                          date: ev.date,
                          ...(ev.start_time ? { time_from: ev.start_time.slice(0, 5) } : {}),
                          ...(ev.end_time ? { time_to: ev.end_time.slice(0, 5) } : {}),
                        },
                      }}
                      class="btn btn--secondary btn--sm"
                    >
                      Найти специалиста
                    </RouterLink>
                  )}
                </div>

                {hasSpecialists ? (
                  <ul class="ep-cards" aria-label="Нанятые специалисты">
                    {ev.specialists.map((s) => {
                      const fullName = `${s.first_name} ${s.last_name}`.trim() || s.email
                      const initials = ((s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')).toUpperCase() || '?'
                      return (
                        <li key={s.id}>
                          <RouterLink
                            to={`/specialists/${s.id}`}
                            class="ep-specialist-card"
                            aria-label={`Специалист ${fullName}${s.specialty ? `, ${s.specialty}` : ''}`}
                          >
                            <div class="ep-specialist-card__avatar" aria-hidden="true">{initials}</div>
                            <div class="ep-specialist-card__body">
                              <strong class="ep-specialist-card__name">{fullName}</strong>
                              {s.specialty && (
                                <span class="ep-specialist-card__specialty">{s.specialty}</span>
                              )}
                            </div>
                            <span class="ep-specialist-card__arrow" aria-hidden="true">→</span>
                          </RouterLink>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div class="ep-empty ep-empty--inline">
                    <span class="ep-empty__icon" aria-hidden="true">🤝</span>
                    <p class="ep-empty__text">Специалисты ещё не наняты</p>
                    <RouterLink
                      to={{
                        path: '/specialists',
                        query: {
                          date: ev.date,
                          ...(ev.start_time ? { time_from: ev.start_time.slice(0, 5) } : {}),
                          ...(ev.end_time ? { time_to: ev.end_time.slice(0, 5) } : {}),
                        },
                      }}
                      class="btn btn--primary"
                    >
                      Найти специалиста
                    </RouterLink>
                  </div>
                )}
              </section>
            </div>

            {/* ── Подробное описание ── */}
            {ev.description && (
              <section class="ep-section ep-section--description" aria-labelledby="ep-desc-title">
                <h2 id="ep-desc-title" class="ep-section__title">Описание</h2>
                <div class="ep-description">
                  {ev.description.split('\n').map((line, i) =>
                    line.trim() ? <p key={i}>{line}</p> : <br key={i} />,
                  )}
                </div>
              </section>
            )}

            {/* ── Системная информация ── */}
            <footer class="ep-footer">
              <dl class="ep-footer__meta">
                <div>
                  <dt>Создано</dt>
                  <dd>{formatDate(ev.created_at)}</dd>
                </div>
                {ev.updated_at !== ev.created_at && (
                  <div>
                    <dt>Обновлено</dt>
                    <dd>{formatDate(ev.updated_at)}</dd>
                  </div>
                )}
                <div>
                  <dt>Организатор</dt>
                  <dd>{ev.renter_info.first_name} {ev.renter_info.last_name}</dd>
                </div>
              </dl>
            </footer>
          </div>

          {/* ── Диалог подтверждения отмены ── */}
          <UiDialog
            open={cancelOpen.value}
            title="Отменить мероприятие?"
            size="sm"
            onClose={closeCancel}
          >
            {{
              default: () => (
                <div class="ep-cancel-confirm">
                  <p class="ep-cancel-confirm__text">
                    Вы уверены, что хотите отменить мероприятие
                    {' '}<strong>«{event.value?.title}»</strong>?
                    Это действие нельзя будет легко отменить.
                  </p>
                  {cancelError.value && (
                    <div class="ecf__alert">
                      <UiAlert variant="error" title="Ошибка">{cancelError.value}</UiAlert>
                    </div>
                  )}
                </div>
              ),
              footer: () => (
                <>
                  <button
                    type="button"
                    class="btn btn--secondary"
                    onClick={closeCancel}
                    disabled={cancelling.value}
                  >
                    Не отменять
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger"
                    onClick={confirmCancel}
                    disabled={cancelling.value}
                    aria-busy={cancelling.value ? 'true' : undefined}
                  >
                    {cancelling.value
                      ? <><span class="spinner" aria-hidden="true" /><span class="sr-only">Отмена</span></>
                      : 'Да, отменить'}
                  </button>
                </>
              ),
            }}
          </UiDialog>

          {/* ── Диалог редактирования ── */}
          <UiDialog
            open={editOpen.value}
            title="Редактировать мероприятие"
            size="lg"
            onClose={closeEdit}
          >
            {{
              default: () => (
                <form
                  id="ep-edit-form"
                  class="ecf"
                  onSubmit={(e) => { e.preventDefault(); submitEdit() }}
                  novalidate
                  aria-label="Форма редактирования мероприятия"
                >
                  {editError.value && (
                    <div class="ecf__alert">
                      <UiAlert variant="error" title="Ошибка">{editError.value}</UiAlert>
                    </div>
                  )}

                  {/* Название */}
                  <UiInput
                    id="ep-edit-title"
                    label="Название мероприятия"
                    modelValue={editForm.title}
                    onUpdate:modelValue={(v: string) => { editForm.title = v }}
                    required
                    error={editErrors.value.title}
                  />

                  {/* Тематика + Статус */}
                  <div class="ecf__row ecf__row--2">
                    <UiSelect
                      id="ep-edit-theme"
                      label="Тематика"
                      modelValue={editForm.theme}
                      onUpdate:modelValue={(v: any) => { editForm.theme = v }}
                      options={themeOptions.value}
                      required
                      error={editErrors.value.theme}
                    />
                    <UiSelect
                      id="ep-edit-status"
                      label="Статус"
                      modelValue={editForm.status}
                      onUpdate:modelValue={(v: any) => { editForm.status = v }}
                      options={statusOptions.value}
                      required
                      error={editErrors.value.status}
                    />
                  </div>

                  {/* Короткое описание */}
                  <div class="input-wrapper">
                    <label class="input-label" for="ep-edit-short">
                      Короткое описание
                      <span class="ecf__char-count" aria-live="polite">
                        {shortDescLen.value}/300
                      </span>
                    </label>
                    <textarea
                      id="ep-edit-short"
                      class={['input ecf__textarea ecf__textarea--sm', editErrors.value.short_description && 'input--error']}
                      value={editForm.short_description}
                      maxlength={300}
                      placeholder="Краткое описание для карточки (до 300 символов)"
                      onInput={(e) => { editForm.short_description = (e.target as HTMLTextAreaElement).value }}
                    />
                    {editErrors.value.short_description && (
                      <p class="input-error" role="alert">{editErrors.value.short_description}</p>
                    )}
                  </div>

                  {/* Полное описание */}
                  <div class="input-wrapper">
                    <label class="input-label" for="ep-edit-desc">Подробное описание</label>
                    <textarea
                      id="ep-edit-desc"
                      class="input ecf__textarea"
                      value={editForm.description}
                      placeholder="Подробная информация о мероприятии..."
                      onInput={(e) => { editForm.description = (e.target as HTMLTextAreaElement).value }}
                    />
                  </div>

                  {/* Подсказка о недоступных полях */}
                  <p class="ep-edit-hint">
                    Дата, время, количество гостей, площадки и специалисты не изменяются через эту форму.
                  </p>
                </form>
              ),

              footer: () => (
                <>
                  <button
                    type="button"
                    class="btn btn--secondary"
                    onClick={closeEdit}
                    disabled={editSubmitting.value}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    form="ep-edit-form"
                    class="btn btn--primary"
                    disabled={editSubmitting.value}
                    aria-busy={editSubmitting.value ? 'true' : undefined}
                  >
                    {editSubmitting.value
                      ? <><span class="spinner" aria-hidden="true" /><span class="sr-only">Сохранение</span></>
                      : 'Сохранить изменения'}
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
