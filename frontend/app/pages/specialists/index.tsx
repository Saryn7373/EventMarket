import { defineComponent, ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS } from '~/utils/constants'
import type { SpecialistPublic } from '~/utils/types'

const PAGE_SIZE = 15

interface Filters {
  rating_min: string
  date: string
  time_from: string
  time_to: string
}

const EMPTY_FILTERS = (): Filters => ({
  rating_min: '', date: '', time_from: '', time_to: '',
})

const RATING_OPTIONS = [
  { value: '', label: 'Любой рейтинг' },
  { value: '4.5', label: '4.5+ ★★★★★' },
  { value: '4.0', label: '4.0+ ★★★★' },
  { value: '3.0', label: '3.0+ ★★★' },
]

export default defineComponent({
  name: 'SpecialistsPage',
  setup() {
    const $api = useApi()
    const route = useRoute()

    // ── Каталог ──
    const items       = ref<SpecialistPublic[]>([])
    const loading     = ref(false)
    const loadingMore = ref(false)
    const hasMore     = ref(true)
    const page        = ref(1)
    const error       = ref<string | null>(null)
    const sentinel    = ref<HTMLDivElement | null>(null)
    let observer: IntersectionObserver | null = null

    // ── Поиск ──
    const searchInput  = ref('')
    const activeSearch = ref('')

    // ── Фильтры ──
    const filtersOpen = ref(false)
    const draft  = reactive<Filters>(EMPTY_FILTERS())
    const active = reactive<Filters>(EMPTY_FILTERS())

    const activeCount = computed(() =>
      [active.rating_min, active.date].filter(Boolean).length,
    )

    const today = () => new Date().toISOString().split('T')[0]

    // ── Утилиты ──
    const recheckSentinel = () => {
      if (!observer || !sentinel.value) return
      observer.unobserve(sentinel.value)
      if (hasMore.value) observer.observe(sentinel.value)
    }

    const buildParams = (): Record<string, any> => {
      const params: Record<string, any> = { page: page.value, page_size: PAGE_SIZE }
      if (activeSearch.value)  params.search     = activeSearch.value
      if (active.rating_min)   params.rating_min = active.rating_min
      if (active.date) {
        const from = active.time_from || '00:00'
        const to   = active.time_to   || '23:59'
        params.available_from = `${active.date}T${from}:00`
        params.available_to   = `${active.date}T${to}:00`
      }
      return params
    }

    // ── Загрузка ──
    const loadItems = async (isReset = false) => {
      if (!hasMore.value && !isReset) return
      if (!isReset && loadingMore.value) return

      error.value = null
      if (isReset) {
        items.value   = []
        page.value    = 1
        hasMore.value = true
        loading.value = true
      } else {
        loadingMore.value = true
      }

      try {
        const res = await $api.get<{ results: SpecialistPublic[]; next: string | null }>(
          API_ENDPOINTS.specialists.list,
          { params: buildParams() },
        )
        items.value   = isReset ? res.results : [...items.value, ...res.results]
        hasMore.value = !!res.next
        page.value++
      } catch (e: any) {
        error.value = e.message || 'Ошибка загрузки данных'
      } finally {
        loading.value     = false
        loadingMore.value = false
        nextTick(recheckSentinel)
      }
    }

    // ── Поиск ──
    const handleSearch = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        activeSearch.value = searchInput.value.trim()
        loadItems(true)
      }
    }

    // ── Фильтры ──
    const toggleFilters = () => { filtersOpen.value = !filtersOpen.value }

    const applyFilters = () => {
      Object.assign(active, { ...draft })
      filtersOpen.value = false
      loadItems(true)
    }

    const resetFilters = () => {
      Object.assign(draft,  EMPTY_FILTERS())
      Object.assign(active, EMPTY_FILTERS())
      filtersOpen.value = false
      loadItems(true)
    }

    // ── IntersectionObserver ──
    onMounted(() => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && !loading.value && !loadingMore.value && hasMore.value)
            loadItems()
        },
        { rootMargin: '0px 0px 400px 0px' },
      )
      nextTick(() => { if (sentinel.value) observer!.observe(sentinel.value) })

      // Применяем фильтры из query-параметров (например, переход с /events/:id)
      const q = route.query
      if (q.date || q.time_from || q.time_to) {
        const fromQuery: Filters = {
          rating_min: '',
          date:       String(q.date      ?? ''),
          time_from:  String(q.time_from ?? ''),
          time_to:    String(q.time_to   ?? ''),
        }
        Object.assign(draft,  fromQuery)
        Object.assign(active, fromQuery)
        filtersOpen.value = true
      }

      loadItems(true)
    })

    onUnmounted(() => { observer?.disconnect() })

    // ── Хелперы ──
    const formatRating = (rating: string) => {
      const n = parseFloat(rating)
      return isNaN(n) ? '—' : n.toFixed(1)
    }

    const ratingStars = (rating: string) => {
      const n = parseFloat(rating)
      if (isNaN(n) || n === 0) return ''
      const filled = Math.round(n)
      return '★'.repeat(filled) + '☆'.repeat(5 - filled)
    }

    const ratingLabel = (value: string) =>
      RATING_OPTIONS.find((o) => o.value === value)?.label ?? value

    // ─── Render ───────────────────────────────────────────────────────────────
    return () => (
      <div class="catalog-page">
        <div class="container">
          <div class="catalog-header">
            <h1 class="catalog-title">Специалисты</h1>
            <p class="catalog-subtitle">Найдите профессионала для вашего мероприятия</p>
          </div>

          {/* ── Строка поиска + кнопка фильтров ── */}
          <div class="catalog-search-row" role="search" aria-label="Поиск и фильтрация специалистов">
            <div class="catalog-search">
              <input
                type="search"
                class="catalog-search__input"
                placeholder="Поиск по имени, специализации или городу..."
                value={searchInput.value}
                onInput={(e) => { searchInput.value = (e.target as HTMLInputElement).value }}
                onKeydown={handleSearch}
                aria-label="Поиск специалистов, нажмите Enter"
              />
              <p class="catalog-search__hint" aria-hidden="true">Нажмите Enter для поиска</p>
            </div>

            <button
              type="button"
              class={['vf-toggle', filtersOpen.value && 'vf-toggle--open', activeCount.value > 0 && 'vf-toggle--active']}
              onClick={toggleFilters}
              aria-expanded={String(filtersOpen.value)}
              aria-controls="specialist-filters"
              aria-label={filtersOpen.value ? 'Скрыть фильтры' : 'Показать фильтры'}
            >
              <span class="vf-toggle__icon" aria-hidden="true">
                <span class="vf-burger-line" />
                <span class="vf-burger-line" />
                <span class="vf-burger-line" />
              </span>
              <span class="vf-toggle__label">Фильтры</span>
              {activeCount.value > 0 && (
                <span class="vf-toggle__badge" aria-label={`Активных фильтров: ${activeCount.value}`}>
                  {activeCount.value}
                </span>
              )}
            </button>
          </div>

          {/* ── Панель фильтров ── */}
          {filtersOpen.value && (
            <div id="specialist-filters" class="vf-panel" role="region" aria-label="Фильтры специалистов">
              <div class="vf-panel__grid">

                {/* Рейтинг */}
                <div class="input-wrapper">
                  <label class="input-label" for="sf-rating">Минимальный рейтинг</label>
                  <select
                    id="sf-rating"
                    class="input"
                    value={draft.rating_min}
                    onChange={(e) => { draft.rating_min = (e.target as HTMLSelectElement).value }}
                  >
                    {RATING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Дата */}
                <div class="input-wrapper">
                  <label class="input-label" for="sf-date">Дата найма</label>
                  <input
                    id="sf-date"
                    type="date"
                    class="input"
                    value={draft.date}
                    min={today()}
                    onInput={(e) => { draft.date = (e.target as HTMLInputElement).value }}
                  />
                </div>

                {/* Время с */}
                <div class="input-wrapper">
                  <label class="input-label" for="sf-time-from">
                    Время с
                    {!draft.date && <span class="vf-hint-inline"> (нужна дата)</span>}
                  </label>
                  <input
                    id="sf-time-from"
                    type="time"
                    class="input"
                    value={draft.time_from}
                    disabled={!draft.date}
                    onInput={(e) => { draft.time_from = (e.target as HTMLInputElement).value }}
                  />
                </div>

                {/* Время до */}
                <div class="input-wrapper">
                  <label class="input-label" for="sf-time-to">
                    Время до
                    {!draft.date && <span class="vf-hint-inline"> (нужна дата)</span>}
                  </label>
                  <input
                    id="sf-time-to"
                    type="time"
                    class="input"
                    value={draft.time_to}
                    disabled={!draft.date}
                    onInput={(e) => { draft.time_to = (e.target as HTMLInputElement).value }}
                  />
                </div>
              </div>

              <div class="vf-panel__footer">
                <button type="button" class="btn btn--secondary btn--sm" onClick={resetFilters}>
                  Сбросить
                </button>
                <button type="button" class="btn btn--primary btn--sm" onClick={applyFilters}>
                  Применить
                </button>
              </div>
            </div>
          )}

          {/* ── Активные фильтры (метки) ── */}
          {activeCount.value > 0 && (
            <div class="vf-active-tags" aria-label="Применённые фильтры" role="list">
              {active.rating_min && (
                <span class="vf-tag" role="listitem">
                  {ratingLabel(active.rating_min)}
                  <button
                    type="button"
                    class="vf-tag__remove"
                    aria-label="Убрать фильтр по рейтингу"
                    onClick={() => { draft.rating_min = ''; active.rating_min = ''; loadItems(true) }}
                  >✕</button>
                </span>
              )}
              {active.date && (
                <span class="vf-tag" role="listitem">
                  {active.date}{active.time_from ? ` ${active.time_from}` : ''}
                  {active.time_to ? `–${active.time_to}` : ''}
                  <button
                    type="button"
                    class="vf-tag__remove"
                    aria-label="Убрать фильтр по дате"
                    onClick={() => {
                      draft.date = ''; draft.time_from = ''; draft.time_to = ''
                      active.date = ''; active.time_from = ''; active.time_to = ''
                      loadItems(true)
                    }}
                  >✕</button>
                </span>
              )}
            </div>
          )}

          {/* ── Список специалистов ── */}
          {loading.value ? (
            <div class="catalog-loading" role="status" aria-live="polite">
              <div class="spinner" aria-hidden="true" />
              <p>Загрузка специалистов...</p>
            </div>
          ) : error.value ? (
            <div class="empty-state" role="alert">
              <div class="empty-state-icon" aria-hidden="true">⚠️</div>
              <p class="empty-state-title">{error.value}</p>
              <button type="button" class="btn btn--primary" onClick={() => loadItems(true)}>
                Повторить
              </button>
            </div>
          ) : items.value.length === 0 ? (
            <div class="empty-state">
              <div class="empty-state-icon" aria-hidden="true">🤝</div>
              <p class="empty-state-title">Специалисты не найдены</p>
              <p>Попробуйте изменить запрос или фильтры</p>
              {activeCount.value > 0 && (
                <button type="button" class="btn btn--secondary" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <ul class="specialists-grid" aria-label="Список специалистов">
              {items.value.map((spec) => {
                const titleId = `spec-${spec.id}-title`
                const fullName = `${spec.first_name} ${spec.last_name}`.trim() || 'Специалист'
                return (
                  <li key={spec.id}>
                    <article class="specialist-card" aria-labelledby={titleId}>
                      <RouterLink
                        to={`/specialists/${spec.id}`}
                        class="specialist-card__avatar-link"
                        tabindex="-1"
                        aria-hidden="true"
                      >
                        <div class="specialist-card__avatar">
                          {spec.avatar ? (
                            <img src={spec.avatar} alt="" loading="lazy" />
                          ) : (
                            <span class="specialist-card__avatar-placeholder">
                              {spec.first_name?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                      </RouterLink>
                      <div class="specialist-card__body">
                        <h3 id={titleId} class="specialist-card__name">
                          <RouterLink to={`/specialists/${spec.id}`} class="specialist-card__name-link">
                            {fullName}
                          </RouterLink>
                        </h3>
                        {spec.specialty && (
                          <p class="specialist-card__specialty">{spec.specialty}</p>
                        )}
                        {spec.city && (
                          <p class="specialist-card__city">
                            <span aria-hidden="true">📍</span> {spec.city}
                          </p>
                        )}
                        {parseFloat(spec.rating) > 0 && (
                          <div class="specialist-card__rating" aria-label={`Рейтинг ${formatRating(spec.rating)} из 5`}>
                            <span class="specialist-card__stars" aria-hidden="true">
                              {ratingStars(spec.rating)}
                            </span>
                            <span class="specialist-card__rating-value">{formatRating(spec.rating)}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}

          {loadingMore.value && (
            <div class="catalog-load-more" role="status" aria-live="polite">
              <div class="spinner" aria-hidden="true" />
              <span>Загружаем ещё...</span>
            </div>
          )}

          {!hasMore.value && items.value.length > 0 && (
            <p class="catalog-end" aria-live="polite">Все специалисты загружены</p>
          )}

          <div ref={sentinel} class="catalog-sentinel" aria-hidden="true" />
        </div>
      </div>
    )
  },
})
