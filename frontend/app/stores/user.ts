import { defineStore } from 'pinia'
import type { User } from '~/utils/types'

interface UserState {
  user: User | null
  isAuthenticated: boolean
}

export const useUserStore = defineStore('user', () => {
  const state = reactive<UserState>({
    user: null,
    isAuthenticated: false,
  })

  const user = computed(() => state.user)
  const isAuthenticated = computed(() => state.isAuthenticated)
  const role = computed(() => state.user?.role ?? null)
  const fullName = computed(() => {
    if (!state.user) return ''
    return `${state.user.first_name} ${state.user.last_name}`.trim()
  })

  function setUser(newUser: User | null) {
    state.user = newUser
    state.isAuthenticated = !!newUser
  }

  function clearUser() {
    state.user = null
    state.isAuthenticated = false
  }

  function updateName(first_name: string, last_name: string) {
    if (state.user) {
      state.user.first_name = first_name
      state.user.last_name = last_name
    }
  }

  function updateAvatar(avatar: string | null) {
    if (state.user) {
      state.user.avatar = avatar
    }
  }

  return {
    user,
    isAuthenticated,
    role,
    fullName,
    setUser,
    clearUser,
    updateName,
    updateAvatar,
  }
})
