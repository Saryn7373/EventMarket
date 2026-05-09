export default defineNuxtRouteMiddleware(() => {
  const $api = useNuxtApp().$api

  if ($api.getAccessToken() || $api.getRefreshToken()) {
    return navigateTo('/dashboard')
  }
})
