import { defineComponent } from 'vue'

export default defineComponent({
  name: 'HomePage',
  setup() {
    return () => (
      <div class="home-page">
        <section class="hero">
          <div class="container">
            <h1 class="hero-title">
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

        <section class="features">
          <div class="container">
            <div class="features-grid">
              <div class="feature-card card">
                <h3 class="feature-title">🏛️ Площадки</h3>
                <p class="feature-text">
                  Более 100 площадок для любого типа мероприятий — от конференций до свадеб
                </p>
              </div>
              <div class="feature-card card">
                <h3 class="feature-title">🎉 Мероприятия</h3>
                <p class="feature-text">
                  Создавайте и управляйте мероприятиями, бронируйте площадки в один клик
                </p>
              </div>
              <div class="feature-card card">
                <h3 class="feature-title">🤝 Специалисты</h3>
                <p class="feature-text">
                  Нанимайте фотографов, ведущих, DJ и других специалистов
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  },
})
