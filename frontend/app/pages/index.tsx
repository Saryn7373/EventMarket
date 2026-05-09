import { defineComponent } from 'vue'

definePageMeta({ middleware: 'home' })

export default defineComponent({
  name: 'HomePage',
  setup() {
    return () => (
      <div class="home-page">
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
      </div>
    )
  },
})
