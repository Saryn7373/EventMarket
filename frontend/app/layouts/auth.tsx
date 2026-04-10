import { defineComponent } from 'vue'

export default defineComponent({
  name: 'AuthLayout',
  setup(_, { slots }) {
    return () => (
      <div class="layout-auth">
        <div class="auth-container">
          <div class="auth-header">
            <a href="/" class="auth-logo">
              EventMarket
            </a>
          </div>

          <div class="auth-card card">
            {slots.default?.()}
          </div>

          <p class="auth-footer-text">
            © {new Date().getFullYear()} EventMarket
          </p>
        </div>
      </div>
    )
  },
})
