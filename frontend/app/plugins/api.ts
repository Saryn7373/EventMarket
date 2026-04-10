import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type { AuthTokens } from '~/utils/types'

export interface ApiClient {
  get: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => Promise<T>
  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) => Promise<T>
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => Promise<T>
  delete: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>
  setAccessToken: (token: string) => void
  clearTokens: () => void
  refreshTokens: () => Promise<AuthTokens>
  /** Получить текущий access токен (для middleware) */
  getAccessToken: () => string | undefined
  /** Получить текущий refresh токен (для middleware) */
  getRefreshToken: () => string | undefined
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  // На сервере (SSR) нужен абсолютный URL
  // На клиенте — относительный (через Vite proxy)
  const isClient = import.meta.client
  const baseURL = isClient ? '/api' : (config.public.apiBaseUrl || 'http://localhost:8000/api')

  const instance: AxiosInstance = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })

  // Helper: работа с cookies — ТОЛЬКО через useCookie (работает и SSR, и client)
  const getCookie = (name: string): string | undefined => {
    const cookie = useCookie<string | null>(name, { path: '/' })
    return cookie.value || undefined
  }

  const setCookie = (name: string, value: string | null) => {
    const cookie = useCookie<string | null>(name, {
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    cookie.value = value
  }

  // Helper: добавляем Authorization header в конфиг запроса
  function withAuth(cfg?: AxiosRequestConfig): AxiosRequestConfig {
    const token = getCookie('access_token')
    const headers = { ...(cfg?.headers || {}) }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return { ...cfg, headers }
  }

  // Helper: извлечение данных из ответа
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

  // API Client объект
  const apiClient: ApiClient = {
    get: <T>(url: string, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.get(url, withAuth(config))),

    post: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.post(url, data, withAuth(config))),

    patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.patch(url, data, withAuth(config))),

    put: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.put(url, data, withAuth(config))),

    delete: <T>(url: string, config?: AxiosRequestConfig) =>
      handleResponse<T>(instance.delete(url, withAuth(config))),

    getAccessToken: () => getCookie('access_token'),

    getRefreshToken: () => getCookie('refresh_token'),

    setAccessToken: (token: string) => {
      setCookie('access_token', token)
    },

    clearTokens: () => {
      setCookie('access_token', null)
      setCookie('refresh_token', null)
    },

    refreshTokens: async () => {
      const refreshTokenValue = getCookie('refresh_token')
      if (!refreshTokenValue) {
        throw new Error('No refresh token')
      }
      const response = await instance.post('/auth/token/refresh/', { refresh: refreshTokenValue })
      const { access, refresh } = response.data
      setCookie('access_token', access)
      setCookie('refresh_token', refresh)
      return { access, refresh }
    },
  }

  return {
    provide: {
      api: apiClient,
    },
  }
})
