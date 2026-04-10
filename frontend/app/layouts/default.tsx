import { defineComponent, onMounted } from 'vue'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS } from '~/utils/constants'
import type { User } from '~/utils/types'

export default defineComponent({
  name: 'DefaultLayout',
  setup(_, { slots }) {
    const userStore = useUserStore()
    const $api = useApi()

    onMounted(async () => {
      // Если пользователь ещё не загружен, пробуем получить данные
      if (!userStore.isAuthenticated) {
        try {
          const user = await $api.get<User>(API_ENDPOINTS.auth.me)
          userStore.setUser(user)
        } catch {
          // Токен невалиден или отсутствует — пользователь не авторизован
          userStore.clearUser()
        }
      }
    })

    return () => (
      <div class="layout-default">
        <header class="app-header">
          <div class="container">
            <nav class="header-nav">
              <a href="/" class="logo">
                EventMarket
              </a>
              <div class="header-links">
                <a href="/venues" class="nav-link">
                  Площадки
                </a>
                {userStore.isAuthenticated ? (
                  <>
                    <a href="/dashboard" class="nav-link">
                      Дашборд
                    </a>
                    <a href="/profile" class="nav-link">
                      Профиль
                    </a>
                    <span class="user-greeting">
                      {userStore.user?.first_name || userStore.user?.email}
                    </span>
                  </>
                ) : (
                  <a href="/auth/login" class="btn btn--primary btn--sm">
                    Войти
                  </a>
                )}
              </div>
            </nav>
          </div>
        </header>

        <main class="app-main">
          {slots.default?.()}
        </main>

        <footer class="app-footer">
          <div class="container">
            <p class="footer-text">
              © {new Date().getFullYear()} EventMarket
            </p>
          </div>
        </footer>
      </div>
    )
  },
})
