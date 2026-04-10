import { useUserStore } from '~/stores/user'
import type { User } from '~/utils/types'

export default defineNuxtRouteMiddleware(async (to) => {
  const $api = useNuxtApp().$api

  // Работаем только на клиенте (SSR не может читать cookies запроса)
  if (import.meta.server) return

  if (!$api.getAccessToken() && !$api.getRefreshToken()) {
    return navigateTo('/auth/login')
  }

  const userStore = useUserStore()
  if (userStore.isAuthenticated) return

  try {
    const user = await $api.get<User>('/auth/me/')
    userStore.setUser(user)
    return
  } catch (err: any) {
    const is401 = err.statusCode === 401 || err.response?.status === 401

    if (is401 && $api.getRefreshToken()) {
      try {
        await $api.refreshTokens()
        const user = await $api.get<User>('/auth/me/')
        userStore.setUser(user)
        return
      } catch {
        $api.clearTokens()
        return navigateTo('/auth/login')
      }
    }

    // ← НЕ чистим токены если это не 401
    // (например, сеть недоступна — не надо разлогинивать)
    if (is401) {
      $api.clearTokens()
      return navigateTo('/auth/login')
    }
  }
})