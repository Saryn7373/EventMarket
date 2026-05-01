import { defineComponent, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS } from '~/utils/constants'
import type { User } from '~/utils/types'

export default defineComponent({
  name: 'DefaultLayout',
  setup(_, { slots }) {
    const userStore = useUserStore()
    const $api = useApi()
    const router = useRouter()

    const logout = async () => {
      const refresh = $api.getRefreshToken()
      if (refresh) {
        try {
          await $api.post(API_ENDPOINTS.auth.logout, { refresh })
        } catch {
          // Токен мог быть уже невалидным — всё равно очищаем локальное состояние
        }
      }
      $api.clearTokens()
      userStore.clearUser()
      router.push('/')
    }

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
        <a href="#main-content" class="skip-link">
          Перейти к основному содержимому
        </a>

        <header class="app-header" role="banner">
          <div class="container">
            <nav class="header-nav" aria-label="Основная навигация">
              <RouterLink to="/" class="logo" aria-label="EventMarket — на главную">
                EventMarket
              </RouterLink>
              <ul class="header-links">
                <li>
                  <RouterLink to="/venues" class="nav-link">
                    Площадки
                  </RouterLink>
                </li>
                {userStore.isAuthenticated ? (
                  <>
                    <li>
                      <RouterLink to="/dashboard" class="nav-link">
                        Дашборд
                      </RouterLink>
                    </li>
                    <li>
                      <RouterLink to="/profile" class="nav-link">
                        Профиль
                      </RouterLink>
                    </li>
                    <li class="user-greeting" aria-live="polite">
                      <span class="sr-only">Вы вошли как </span>
                      {userStore.user?.first_name || userStore.user?.email}
                    </li>
                    <li>
                      <button
                        type="button"
                        class="btn btn--secondary btn--sm"
                        onClick={logout}
                      >
                        Выйти
                      </button>
                    </li>
                  </>
                ) : (
                  <li>
                    <RouterLink to="/auth/login" class="btn btn--primary btn--sm">
                      Войти
                    </RouterLink>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </header>

        <main id="main-content" class="app-main" tabindex="-1">
          {slots.default?.()}
        </main>

        <footer class="app-footer" role="contentinfo">
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
