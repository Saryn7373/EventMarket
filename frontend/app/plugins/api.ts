// api.ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type { AuthTokens } from '~/utils/types'

export interface ApiClient {
  get: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => Promise<T>
  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) => Promise<T>
  /** Отправляет FormData как multipart/form-data (Content-Type ставится браузером с boundary) */
  patchForm: <T>(url: string, data: FormData, config?: AxiosRequestConfig) => Promise<T>
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => Promise<T>
  delete: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>
  setAccessToken: (token: string) => void
  setRefreshToken: (token: string) => void
  clearTokens: () => void
  refreshTokens: () => Promise<AuthTokens>
  getAccessToken: () => string | undefined
  getRefreshToken: () => string | undefined
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const isClient = import.meta.client
  const baseURL = isClient
    ? '/api'
    : config.public.apiBaseUrl || 'http://localhost:8000/api'

  const instance: AxiosInstance = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })

  // ✅ Создаём рефы ОДИН РАЗ в setup-контексте плагина
  const accessTokenCookie = useCookie<string | null>('access_token', {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })

  const refreshTokenCookie = useCookie<string | null>('refresh_token', {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })

  function withAuth(cfg?: AxiosRequestConfig): AxiosRequestConfig {
    const token = accessTokenCookie.value
    const headers = { ...(cfg?.headers || {}) }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return { ...cfg, headers }
  }

  const handleResponse = async <T>(promise: Promise<any>): Promise<T> => {
    try {
      const response = await promise
      return response.data as T
    } catch (error: any) {
      if (error.response?.data) {
        const data = error.response.data
        throw createError({
          statusCode: error.response.status,
          message: data.detail || JSON.stringify(data),
          data,
        })
      }
      throw createError({
        statusCode: 500,
        message: error.message || 'Неизвестная ошибка',
      })
    }
  }

  const apiClient: ApiClient = {
    get: <T>(url: string, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.get(url, withAuth(config))),

    post: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.post(url, data, withAuth(config))),

    patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.patch(url, data, withAuth(config))),

    patchForm: <T>(url: string, data: FormData, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.patchForm(url, data, withAuth(config))),

    put: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.put(url, data, withAuth(config))),

    delete: <T>(url: string, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.delete(url, withAuth(config))),

    // ✅ Читаем из реактивных рефов, а не пересоздаём useCookie
    getAccessToken: () => accessTokenCookie.value ?? undefined,
    getRefreshToken: () => refreshTokenCookie.value ?? undefined,
    
    setRefreshToken: (token: string) => {
      refreshTokenCookie.value = token
    },

    setAccessToken: (token: string) => {
      accessTokenCookie.value = token
    },

    clearTokens: () => {
      accessTokenCookie.value = null
      refreshTokenCookie.value = null
    },

    refreshTokens: async () => {
      const refreshTokenValue = refreshTokenCookie.value
      if (!refreshTokenValue) {
        throw new Error('No refresh token')
      }
      const response = await instance.post('/auth/token/refresh/', {
        refresh: refreshTokenValue,
      })
      const { access, refresh } = response.data
      accessTokenCookie.value = access
      refreshTokenCookie.value = refresh
      return { access, refresh }
    },
  }

  return {
    provide: {
      api: apiClient,
    },
  }
})