import { defineComponent, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS } from '~/utils/constants'
import type { Venue, SpecialistPublic, TopOrganizer } from '~/utils/types'

definePageMeta({ middleware: 'home' })

export default defineComponent({
  name: 'HomePage',
  setup() {
    const $api = useApi()

    const venues      = ref<Venue[]>([])
    const specialists = ref<SpecialistPublic[]>([])
    const organizers  = ref<TopOrganizer[]>([])

    const formatCurrency = (amount: number | null): string => {
      if (!amount) return 'Не указана'
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency', currency: 'RUB', minimumFractionDigits: 0,
      }).format(amount)
    }

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

    const pluralEvents = (n: number) => {
      const mod10 = n % 10
      const mod100 = n % 100
      if (mod100 >= 11 && mod100 <= 19) return `${n} мероприятий`
      if (mod10 === 1) return `${n} мероприятие`
      if (mod10 >= 2 && mod10 <= 4) return `${n} мероприятия`
      return `${n} мероприятий`
    }

    onMounted(async () => {
      const [venuesRes, specialistsRes, organizersRes] = await Promise.allSettled([
        $api.get<{ results: Venue[] }>(API_ENDPOINTS.venues.list, { params: { page_size: 3 } }),
        $api.get<{ results: SpecialistPublic[] }>(API_ENDPOINTS.specialists.list, { params: { page_size: 3, ordering: '-rating' } }),
        $api.get<TopOrganizer[]>(API_ENDPOINTS.auth.topOrganizers),
      ])
      if (venuesRes.status === 'fulfilled')      venues.value      = venuesRes.value.results
      if (specialistsRes.status === 'fulfilled') specialists.value = specialistsRes.value.results
      if (organizersRes.status === 'fulfilled')  organizers.value  = organizersRes.value
    })

    return () => (
      <div class="home-page">
        {/* ── Hero ── */}
        <section class="hero" aria-labelledby="hero-title">
          <div class="container">
            <h1 id="hero-title" class="hero-title">
              EventMarket
            </h1>
            <p class="hero-subtitle">
              Платформа аренды площадок и найма специалистов для мероприятий
            </p>
            <div class="hero-actions">
              <a href="/venues" class="btn btn--primary btn--lg">
                Найти площадку
              </a>
              <a href="/auth/register" class="btn btn--secondary btn--lg">
                Зарегистрироваться
              </a>
            </div>
          </div>
        </section>

        {/* ── Фичи ── */}
        <section class="features" aria-labelledby="features-title">
          <div class="container">
            <h2 id="features-title" class="sr-only">
              Возможности платформы
            </h2>
            <ul class="features-grid">
              <li class="feature-card card">
                <h3 class="feature-title">
                  <span aria-hidden="true">🏛️</span> Площадки
                </h3>
                <p class="feature-text">
                  Более 100 площадок для любого типа мероприятий — от конференций до свадеб
                </p>
              </li>
              <li class="feature-card card">
                <h3 class="feature-title">
                  <span aria-hidden="true">🎉</span> Мероприятия
                </h3>
                <p class="feature-text">
                  Создавайте и управляйте мероприятиями, бронируйте площадки в один клик
                </p>
              </li>
              <li class="feature-card card">
                <h3 class="feature-title">
                  <span aria-hidden="true">🤝</span> Специалисты
                </h3>
                <p class="feature-text">
                  Нанимайте фотографов, ведущих, DJ и других специалистов
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* ── Площадки ── */}
        {venues.value.length > 0 && (
          <section class="home-section" aria-labelledby="home-venues-title">
            <div class="container">
              <div class="home-section__header">
                <h2 id="home-venues-title" class="home-section__title">Площадки</h2>
                <RouterLink to="/venues" class="home-section__link">Смотреть все →</RouterLink>
              </div>
              <ul class="home-venues-grid" aria-label="Площадки">
                {venues.value.map((venue) => {
                  const titleId = `hv-${venue.id}-title`
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
            </div>
          </section>
        )}

        {/* ── Лучшие специалисты ── */}
        {specialists.value.length > 0 && (
          <section class="home-section" aria-labelledby="home-specialists-title">
            <div class="container">
              <div class="home-section__header">
                <h2 id="home-specialists-title" class="home-section__title">Лучшие специалисты</h2>
                <RouterLink to="/specialists" class="home-section__link">Смотреть все →</RouterLink>
              </div>
              <ul class="home-specialists-grid" aria-label="Лучшие специалисты">
                {specialists.value.map((spec) => {
                  const titleId = `hs-${spec.id}-title`
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
            </div>
          </section>
        )}
        {/* ── Топ организаторов ── */}
        {organizers.value.length > 0 && (
          <section class="home-section" aria-labelledby="home-organizers-title">
            <div class="container">
              <div class="home-section__header">
                <h2 id="home-organizers-title" class="home-section__title">Самые активные организаторы</h2>
              </div>
              <ul class="home-organizers-grid" aria-label="Активные организаторы">
                {organizers.value.map((org, i) => {
                  const fullName = `${org.first_name} ${org.last_name}`.trim() || 'Организатор'
                  const initials = `${org.first_name?.[0] ?? ''}${org.last_name?.[0] ?? ''}`.toUpperCase() || '?'
                  return (
                    <li key={org.id}>
                      <article class="organizer-card card">
                        <div class="organizer-card__rank" aria-hidden="true">#{i + 1}</div>
                        <div class="organizer-card__avatar">
                          {org.avatar
                            ? <img src={org.avatar} alt="" class="organizer-card__avatar-img" />
                            : <span class="organizer-card__avatar-initials" aria-hidden="true">{initials}</span>
                          }
                        </div>
                        <div class="organizer-card__body">
                          <p class="organizer-card__name">{fullName}</p>
                          <p class="organizer-card__count">
                            <span class="organizer-card__count-num">{org.completed_events}</span>
                            {' '}проведённых{' '}
                            {org.completed_events === 1 ? 'мероприятие'
                              : (org.completed_events >= 2 && org.completed_events <= 4) ? 'мероприятия'
                              : 'мероприятий'}
                          </p>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        )}
      </div>
    )
  },
})
