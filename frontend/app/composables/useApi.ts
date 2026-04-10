import type { Ref } from 'vue'
import type { ApiClient } from '~/plugins/api'

/**
 * Composable для получения API клиента
 */
export function useApi() {
  const { $api } = useNuxtApp()
  return $api as ApiClient
}

/**
 * Composable для выполнения API запросов с состоянием
 *
 * Пример использования:
 * ```ts
 * const { data, loading, error, execute } = useAsyncApi(
 *   (api) => api.get<Event>('/events/my/'),
 *   { immediate: true }
 * )
 * ```
 */
export function useAsyncApi<T>(
  apiCall: (api: ApiClient, ...args: any[]) => Promise<T>,
  options: { immediate?: boolean } = {}
) {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  const execute = async (...args: any[]) => {
    loading.value = true
    error.value = null

    try {
      const api = useApi()
      data.value = await apiCall(api, ...args)
      return data.value
    } catch (err: any) {
      error.value = err.message || 'Произошла ошибка'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Выполняем сразу если нужно (только на клиенте)
  if (options.immediate !== false && import.meta.client) {
    execute()
  }

  return {
    data,
    loading,
    error,
    execute,
  }
}

/**
 * Composable для пагинированных списков
 *
 * Пример использования:
 * ```ts
 * const { items, loading, pagination, fetch, goToPage } = usePaginatedApi<Event>('/events/my/')
 * ```
 */
export function usePaginatedApi<T>(
  endpoint: string,
  options: { immediate?: boolean; pageSize?: number } = {}
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    count: 0,
    next: null as string | null,
    previous: null as string | null,
  })

  const currentPage = ref(1)
  const pageSize = ref(options.pageSize || 12)

  const fetch = async (params: Record<string, any> = {}) => {
    loading.value = true
    error.value = null

    try {
      const api = useApi()
      const query: Record<string, any> = {
        ...params,
        page: currentPage.value,
        page_size: pageSize.value,
      }

      // Убираем undefined/null значения
      Object.keys(query).forEach(key => {
        if (query[key] === undefined || query[key] === null) {
          delete query[key]
        }
      })

      const response = await api.get<{
        results: T[]
        count: number
        next: string | null
        previous: string | null
      }>(endpoint, { params: query })

      items.value = response.results
      pagination.value = {
        count: response.count,
        next: response.next,
        previous: response.previous,
      }
    } catch (err: any) {
      error.value = err.message || 'Произошла ошибка'
    } finally {
      loading.value = false
    }
  }

  const goToPage = (page: number) => {
    currentPage.value = page
    fetch()
  }

  const nextPage = () => {
    if (hasNext.value) {
      currentPage.value++
      fetch()
    }
  }

  const prevPage = () => {
    if (hasPrevious.value) {
      currentPage.value--
      fetch()
    }
  }

  const hasNext = computed(() => !!pagination.value.next)
  const hasPrevious = computed(() => !!pagination.value.previous)
  const totalPages = computed(() => Math.ceil(pagination.value.count / pageSize.value))

  // Выполняем сразу если нужно (только на клиенте)
  if (options.immediate !== false && import.meta.client) {
    fetch()
  }

  return {
    items,
    loading,
    error,
    pagination,
    currentPage,
    pageSize,
    fetch,
    goToPage,
    nextPage,
    prevPage,
    hasNext,
    hasPrevious,
    totalPages,
  }
}
