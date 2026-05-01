import { defineComponent } from 'vue'
import { RouterLink } from 'vue-router'

export default defineComponent({
  name: 'AuthLayout',
  setup(_, { slots }) {
    return () => (
      <div class="layout-auth">
        <a href="#main-content" class="skip-link">
          Перейти к основному содержимому
        </a>

        <div class="auth-container">
          <header class="auth-header" role="banner">
            <RouterLink to="/" class="auth-logo" aria-label="EventMarket — на главную">
              EventMarket
            </RouterLink>
          </header>

          <main id="main-content" class="auth-card card" tabindex="-1">
            {slots.default?.()}
          </main>

          <footer class="auth-footer" role="contentinfo">
            <p class="auth-footer-text">
              © {new Date().getFullYear()} EventMarket
            </p>
          </footer>
        </div>
      </div>
    )
  },
})
