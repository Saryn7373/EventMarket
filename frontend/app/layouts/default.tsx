import { defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
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
    const route = useRoute()

    const menuOpen = ref(false)
    const navRef = ref<HTMLElement | null>(null)

    const closeMenu = () => { menuOpen.value = false }
    const toggleMenu = () => { menuOpen.value = !menuOpen.value }

    // Закрываем меню при смене маршрута
    watch(() => route.fullPath, closeMenu)

    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.value && !navRef.value.contains(e.target as Node)) {
        closeMenu()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen.value) closeMenu()
    }

    const logout = async () => {
      const refresh = $api.getRefreshToken()
      if (refresh) {
        try {
          await $api.post(API_ENDPOINTS.auth.logout, { refresh })
        } catch { /* токен уже невалиден */ }
      }
      $api.clearTokens()
      userStore.clearUser()
      router.push('/')
    }

    onMounted(async () => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)

      if (!userStore.isAuthenticated) {
        try {
          const user = await $api.get<User>(API_ENDPOINTS.auth.me)
          userStore.setUser(user)
        } catch {
          userStore.clearUser()
        }
      }
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    })

    return () => (
      <div class="layout-default">
        <a href="#main-content" class="skip-link">
          Перейти к основному содержимому
        </a>

        <header class="app-header" role="banner">
          <div class="container">
            <nav ref={navRef} class="header-nav" aria-label="Основная навигация">
              <RouterLink to="/" class="logo" aria-label="EventMarket — на главную">
                EventMarket
              </RouterLink>

              {/* Бургер-кнопка — видна только на узких экранах */}
              <button
                type="button"
                class={['burger-btn', menuOpen.value && 'burger-btn--open']}
                aria-label={menuOpen.value ? 'Закрыть меню' : 'Открыть меню'}
                aria-expanded={String(menuOpen.value)}
                aria-controls="main-nav-links"
                onClick={toggleMenu}
              >
                <span class="burger-line" />
                <span class="burger-line" />
                <span class="burger-line" />
              </button>

              <ul
                id="main-nav-links"
                class={['header-links', menuOpen.value && 'header-links--open']}
              >
                <li>
                  <RouterLink to="/venues" class="nav-link" onClick={closeMenu}>
                    Площадки
                  </RouterLink>
                </li>
                <li>
                  <RouterLink to="/specialists" class="nav-link" onClick={closeMenu}>
                    Специалисты
                  </RouterLink>
                </li>

                {userStore.isAuthenticated ? (
                  <>
                    <li>
                      <RouterLink to="/dashboard" class="nav-link" onClick={closeMenu}>
                        Дашборд
                      </RouterLink>
                    </li>
                    <li>
                      <RouterLink to="/profile" class="nav-link" onClick={closeMenu}>
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
                    <RouterLink
                      to="/auth/login"
                      class="btn btn--primary btn--sm"
                      onClick={closeMenu}
                    >
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
