import { defineComponent, ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useApi } from '~/composables/useApi'
import type { Venue } from '~/utils/types'

const PAGE_SIZE = 15

interface Filters {
  city: string
  guests: string
  date: string
  time_from: string
  time_to: string
}

const EMPTY_FILTERS = (): Filters => ({
  city: '', guests: '', date: '', time_from: '', time_to: '',
})

export default defineComponent({
  name: 'VenuesPage',
  setup() {
    const $api = useApi()
    const route = useRoute()

    // ── Каталог ──
    const items      = ref<Venue[]>([])
    const loading    = ref(false)
    const loadingMore = ref(false)
    const hasMore    = ref(true)
    const page       = ref(1)
    const error      = ref<string | null>(null)
    const sentinel   = ref<HTMLDivElement | null>(null)
    let observer: IntersectionObserver | null = null

    // ── Поиск ──
    const searchInput  = ref('')
    const activeSearch = ref('')

    // ── Фильтры ──
    const filtersOpen  = ref(false)
    const draft   = reactive<Filters>(EMPTY_FILTERS())   // то, что редактируется в панели
    const active  = reactive<Filters>(EMPTY_FILTERS())   // то, что реально применено

    const activeCount = computed(() =>
      [active.city, active.guests, active.date].filter(Boolean).length,
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
      if (activeSearch.value) params.search = activeSearch.value
      if (active.city)        params.city   = active.city
      if (active.guests)      params.guests = active.guests
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
        items.value = []
        page.value  = 1
        hasMore.value = true
        loading.value = true
      } else {
        loadingMore.value = true
      }

      try {
        const res = await $api.get<{ results: Venue[]; next: string | null }>(
          '/venues/',
          { params: buildParams() },
        )
        items.value = isReset ? res.results : [...items.value, ...res.results]
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
      Object.assign(draft,   EMPTY_FILTERS())
      Object.assign(active,  EMPTY_FILTERS())
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
      if (q.date || q.guests || q.time_from || q.time_to) {
        const fromQuery: Filters = {
          city:      '',
          guests:    String(q.guests    ?? ''),
          date:      String(q.date      ?? ''),
          time_from: String(q.time_from ?? ''),
          time_to:   String(q.time_to   ?? ''),
        }
        Object.assign(draft,  fromQuery)
        Object.assign(active, fromQuery)
        filtersOpen.value = true
      }

      loadItems(true)
    })

    onUnmounted(() => { observer?.disconnect() })

    // ── Хелперы ──
    const formatCurrency = (amount: number | null): string => {
      if (!amount) return 'Не указана'
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency', currency: 'RUB', minimumFractionDigits: 0,
      }).format(amount)
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return () => (
      <div class="catalog-page">
        <div class="container">
          <div class="catalog-header">
            <h1 class="catalog-title">Площадки</h1>
            <p class="catalog-subtitle">Найдите идеальное место для вашего мероприятия</p>
          </div>

          {/* ── Строка поиска + кнопка фильтров ── */}
          <div class="catalog-search-row" role="search" aria-label="Поиск и фильтрация площадок">
            <div class="catalog-search">
              <input
                type="search"
                class="catalog-search__input"
                placeholder="Поиск по названию, городу или адресу..."
                value={searchInput.value}
                onInput={(e) => { searchInput.value = (e.target as HTMLInputElement).value }}
                onKeydown={handleSearch}
                aria-label="Поиск площадок, нажмите Enter"
              />
              <p class="catalog-search__hint" aria-hidden="true">Нажмите Enter для поиска</p>
            </div>

            <button
              type="button"
              class={['vf-toggle', filtersOpen.value && 'vf-toggle--open', activeCount.value > 0 && 'vf-toggle--active']}
              onClick={toggleFilters}
              aria-expanded={String(filtersOpen.value)}
              aria-controls="venue-filters"
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
            <div id="venue-filters" class="vf-panel" role="region" aria-label="Фильтры площадок">
              <div class="vf-panel__grid">

                {/* Город */}
                <div class="input-wrapper">
                  <label class="input-label" for="vf-city">Город</label>
                  <input
                    id="vf-city"
                    type="text"
                    class="input"
                    value={draft.city}
                    placeholder="Например: Москва"
                    onInput={(e) => { draft.city = (e.target as HTMLInputElement).value }}
                  />
                </div>

                {/* Гости */}
                <div class="input-wrapper">
                  <label class="input-label" for="vf-guests">Минимальная вместимость</label>
                  <input
                    id="vf-guests"
                    type="number"
                    class="input"
                    value={draft.guests}
                    placeholder="Кол-во гостей"
                    min="1"
                    onInput={(e) => { draft.guests = (e.target as HTMLInputElement).value }}
                  />
                </div>

                {/* Дата */}
                <div class="input-wrapper">
                  <label class="input-label" for="vf-date">Дата бронирования</label>
                  <input
                    id="vf-date"
                    type="date"
                    class="input"
                    value={draft.date}
                    min={today()}
                    onInput={(e) => { draft.date = (e.target as HTMLInputElement).value }}
                  />
                </div>

                {/* Время с */}
                <div class="input-wrapper">
                  <label class="input-label" for="vf-time-from">
                    Время с
                    {!draft.date && <span class="vf-hint-inline"> (нужна дата)</span>}
                  </label>
                  <input
                    id="vf-time-from"
                    type="time"
                    class="input"
                    value={draft.time_from}
                    disabled={!draft.date}
                    onInput={(e) => { draft.time_from = (e.target as HTMLInputElement).value }}
                  />
                </div>

                {/* Время до */}
                <div class="input-wrapper">
                  <label class="input-label" for="vf-time-to">
                    Время до
                    {!draft.date && <span class="vf-hint-inline"> (нужна дата)</span>}
                  </label>
                  <input
                    id="vf-time-to"
                    type="time"
                    class="input"
                    value={draft.time_to}
                    disabled={!draft.date}
                    onInput={(e) => { draft.time_to = (e.target as HTMLInputElement).value }}
                  />
                </div>
              </div>

              <div class="vf-panel__footer">
                <button
                  type="button"
                  class="btn btn--secondary btn--sm"
                  onClick={resetFilters}
                >
                  Сбросить
                </button>
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  onClick={applyFilters}
                >
                  Применить
                </button>
              </div>
            </div>
          )}

          {/* ── Активные фильтры (метки) ── */}
          {activeCount.value > 0 && (
            <div class="vf-active-tags" aria-label="Применённые фильтры" role="list">
              {active.city && (
                <span class="vf-tag" role="listitem">
                  Город: {active.city}
                  <button
                    type="button"
                    class="vf-tag__remove"
                    aria-label="Убрать фильтр по городу"
                    onClick={() => { draft.city = ''; active.city = ''; loadItems(true) }}
                  >✕</button>
                </span>
              )}
              {active.guests && (
                <span class="vf-tag" role="listitem">
                  Мест ≥ {active.guests}
                  <button
                    type="button"
                    class="vf-tag__remove"
                    aria-label="Убрать фильтр по вместимости"
                    onClick={() => { draft.guests = ''; active.guests = ''; loadItems(true) }}
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

          {/* ── Список площадок ── */}
          {loading.value ? (
            <div class="catalog-loading" role="status" aria-live="polite">
              <div class="spinner" aria-hidden="true" />
              <p>Загрузка площадок...</p>
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
              <div class="empty-state-icon" aria-hidden="true">🏛️</div>
              <p class="empty-state-title">Площадки не найдены</p>
              <p>Попробуйте изменить запрос или фильтры</p>
              {activeCount.value > 0 && (
                <button type="button" class="btn btn--secondary" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <ul class="venues-grid" aria-label="Список площадок">
              {items.value.map((venue) => {
                const titleId = `venue-${venue.id}-title`
                return (
                  <li key={venue.id}>
                    <article class="pub-venue-card" aria-labelledby={titleId}>
                      <RouterLink
                        to={`/venues/${venue.slug}`}
                        class="pub-venue-card__link"
                        aria-label={`Открыть страницу площадки «${venue.name}»`}
                        tabindex="-1"
                        aria-hidden="true"
                      >
                        {venue.main_photo ? (
                          <div class="pub-venue-card__photo">
                            <img src={venue.main_photo} alt="" loading="lazy" />
                          </div>
                        ) : (
                          <div class="pub-venue-card__photo pub-venue-card__photo--placeholder" aria-hidden="true">
                            🏛️
                          </div>
                        )}
                      </RouterLink>
                      <div class="pub-venue-card__body">
                        <h3 id={titleId} class="pub-venue-card__title">
                          <RouterLink to={`/venues/${venue.slug}`} class="pub-venue-card__title-link">
                            {venue.name}
                          </RouterLink>
                        </h3>
                        <p class="pub-venue-card__location">
                          <span aria-hidden="true">📍</span>{' '}
                          {venue.city}{venue.address ? `, ${venue.address}` : ''}
                        </p>
                        <dl class="pub-venue-card__details">
                          <div class="pub-venue-card__detail">
                            <dt>Вместимость</dt>
                            <dd>
                              {venue.capacity_min && venue.capacity_max
                                ? `${venue.capacity_min}–${venue.capacity_max} чел.`
                                : `до ${venue.capacity_max} чел.`}
                            </dd>
                          </div>
                          {venue.price_per_hour && (
                            <div class="pub-venue-card__detail">
                              <dt>За час</dt>
                              <dd class="pub-venue-card__price">{formatCurrency(venue.price_per_hour)}</dd>
                            </div>
                          )}
                          {venue.price_per_day && (
                            <div class="pub-venue-card__detail">
                              <dt>За день</dt>
                              <dd class="pub-venue-card__price">{formatCurrency(venue.price_per_day)}</dd>
                            </div>
                          )}
                        </dl>
                        {venue.is_verified && (
                          <span class="pub-venue-card__verified" title="Верифицированная площадка">
                            <span aria-hidden="true">✓</span> Верифицировано
                          </span>
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
            <p class="catalog-end" aria-live="polite">Все площадки загружены</p>
          )}

          <div ref={sentinel} class="catalog-sentinel" aria-hidden="true" />
        </div>
      </div>
    )
  },
})
