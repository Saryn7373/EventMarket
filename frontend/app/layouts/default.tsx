import { defineComponent, onMounted } from 'vue'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS } from '~/utils/constants'
import type { User } from '~/utils/types'
import { useRouter } from 'vue-router'

export default defineComponent({
  name: 'DefaultLayout',
  setup(_, { slots }) {
    const userStore = useUserStore()
    const $api = useApi()
    const router = useRouter()

    const navigate = (path: string) => {
      router.push(path)
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
        <header class="app-header">
          <div class="container">
            <nav class="header-nav">
              <div class="logo" onClick={() => navigate('/')}>
                EventMarket
              </div>
              <div class="header-links">
                <div class="nav-link" onClick={() => navigate('/venues')}>
                  Площадки
                </div>
                {userStore.isAuthenticated ? (
                  <>
                    <div class="nav-link" onClick={() => navigate('/dashboard')}>
                      Дашборд
                    </div>
                    <div class="nav-link" onClick={() => navigate('/profile')}>
                      Профиль
                    </div>
                    <span class="user-greeting">
                      {userStore.user?.first_name || userStore.user?.email}
                    </span>
                  </>
                ) : (
                  <button class="btn btn--primary btn--sm" onClick={() => navigate('/auth/login')}>
                    Войти
                  </button>
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
