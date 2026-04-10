import { useUserStore } from '~/stores/user'
import type { User } from '~/utils/types'

export default defineNuxtRouteMiddleware(async (to) => {
  const $api = useNuxtApp().$api

  // Нет токенов — редирект на логин
  if (!$api.getAccessToken() && !$api.getRefreshToken()) {
    return navigateTo('/auth/login')
  }

  // Если пользователь уже загружен — пропускаем
  const userStore = useUserStore()
  if (userStore.isAuthenticated) {
    return
  }

  // Пробуем загрузить пользователя
  try {
    const user = await $api.get<User>('/auth/me/')
    userStore.setUser(user)
    return
  } catch (err: any) {
    const is401 = err.statusCode === 401 || err.response?.status === 401

    if (is401 && $api.getRefreshToken()) {
      // Пробуем refresh
      try {
        const tokens = await $api.refreshTokens()
        const user = await $api.get<User>('/auth/me/')
        userStore.setUser(user)
        return
      } catch {
        $api.clearTokens()
        return navigateTo('/auth/login')
      }
    }

    // Refresh не удался или нет refresh-токена
    $api.clearTokens()
    return navigateTo('/auth/login')
  }
})
