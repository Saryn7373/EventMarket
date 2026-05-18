import { defineComponent, ref, computed, onUnmounted } from 'vue'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import { API_ENDPOINTS, USER_ROLES } from '~/utils/constants'
import type { User, ChangePasswordPayload } from '~/utils/types'
import UiButton from '~/components/ui/Button'
import UiInput from '~/components/ui/Input'
import UiAlert from '~/components/ui/Alert'

definePageMeta({
  middleware: 'auth',
  ssr: false,
})

export default defineComponent({
  name: 'ProfilePage',
  setup() {
    const userStore = useUserStore()
    const $api = useApi()

    // Режимы отображения
    const isEditing = ref(false)
    const showPasswordForm = ref(false)

    // Форма редактирования имени
    const firstName = ref(userStore.user?.first_name || '')
    const lastName = ref(userStore.user?.last_name || '')

    // Форма смены пароля
    const oldPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')

    // Состояния аватара
    const avatarFile = ref<File | null>(null)
    const avatarPreview = ref<string | null>(null)

    // Состояния
    const loading = ref(false)
    const saving = ref(false)
    const successMessage = ref<string | null>(null)
    const errorMessage = ref<string | null>(null)
    const validationErrors = ref<Record<string, string[]>>({})

    const userRole = computed(() => userStore.user?.role ?? 'unknown')
    const userRoleDisplay = computed(() => USER_ROLES[userRole.value])
    const userEmail = computed(() => userStore.user?.email || '')
    const dateJoined = computed(() => {
      if (!userStore.user?.date_joined) return ''
      return new Date(userStore.user.date_joined).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    })

    const clearMessages = () => {
      successMessage.value = null
      errorMessage.value = null
      validationErrors.value = {}
    }

    const clearAvatarState = () => {
      if (avatarPreview.value) {
        URL.revokeObjectURL(avatarPreview.value)
        avatarPreview.value = null
      }
      avatarFile.value = null
    }

    const handleAvatarChange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      clearAvatarState()
      avatarFile.value = file
      avatarPreview.value = URL.createObjectURL(file)
    }

    const enableEditing = () => {
      isEditing.value = true
      firstName.value = userStore.user?.first_name || ''
      lastName.value = userStore.user?.last_name || ''
      clearMessages()
    }

    const cancelEditing = () => {
      isEditing.value = false
      clearAvatarState()
      clearMessages()
    }

    const saveProfile = async () => {
      saving.value = true
      clearMessages()
      validationErrors.value = {}

      try {
        let updatedUser: User

        if (avatarFile.value) {
          const fd = new FormData()
          fd.append('first_name', firstName.value)
          fd.append('last_name', lastName.value)
          fd.append('avatar', avatarFile.value)
          updatedUser = await $api.patchForm<User>(API_ENDPOINTS.auth.me, fd)
        } else {
          updatedUser = await $api.patch<User>(API_ENDPOINTS.auth.me, {
            first_name: firstName.value,
            last_name: lastName.value,
          })
        }

        userStore.setUser(updatedUser)
        clearAvatarState()

        successMessage.value = 'Профиль успешно обновлён'
        isEditing.value = false
      } catch (err: any) {
        if (err.data && typeof err.data === 'object') {
          validationErrors.value = err.data
        }
        errorMessage.value = err.message || 'Ошибка при сохранении'
        console.error('Error saving profile:', err)
      } finally {
        saving.value = false
      }
    }

    onUnmounted(() => {
      clearAvatarState()
    })

    const togglePasswordForm = () => {
      showPasswordForm.value = !showPasswordForm.value
      if (!showPasswordForm.value) {
        oldPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
        clearMessages()
      }
    }

    const changePassword = async () => {
      if (newPassword.value !== confirmPassword.value) {
        errorMessage.value = 'Пароли не совпадают'
        return
      }

      if (newPassword.value.length < 8) {
        errorMessage.value = 'Пароль должен содержать минимум 8 символов'
        return
      }

      saving.value = true
      clearMessages()

      try {
        await $api.post(API_ENDPOINTS.auth.changePassword, {
          old_password: oldPassword.value,
          new_password: newPassword.value,
        } as ChangePasswordPayload)

        successMessage.value = 'Пароль успешно изменён'
        showPasswordForm.value = false
        oldPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
      } catch (err: any) {
        if (err.data && typeof err.data === 'object') {
          validationErrors.value = err.data
        }
        errorMessage.value = err.message || 'Ошибка при смене пароля'
        console.error('Error changing password:', err)
      } finally {
        saving.value = false
      }
    }

    const getInitials = (): string => {
      const first = userStore.user?.first_name?.charAt(0) || ''
      const last = userStore.user?.last_name?.charAt(0) || ''
      return `${first}${last}`.toUpperCase() || 'П'
    }

    const currentAvatarUrl = computed(() =>
      avatarPreview.value || userStore.user?.avatar || null
    )

    return () => (
      <div class="profile-page">
        <div class="container">
          <header class="profile-header">
            <h1 class="profile-title">Профиль</h1>
            <p class="profile-subtitle">Управление личными данными</p>
          </header>

          {/* Сообщения */}
          {successMessage.value && (
            <UiAlert variant="success" title={successMessage.value} />
          )}
          {errorMessage.value && (
            <UiAlert variant="error" title={errorMessage.value} />
          )}

          <div class="profile-content">
            {/* Основная информация */}
            <section class="profile-section card" aria-labelledby="profile-personal-title">
              <div class="section-header">
                <h2 id="profile-personal-title" class="section-title">Личная информация</h2>
                {!isEditing.value && (
                  <UiButton onClick={enableEditing} variant="ghost" size="sm">
                    Редактировать
                  </UiButton>
                )}
              </div>

              <div class="profile-avatar">
                {isEditing.value ? (
                  <div class="avatar-edit-wrapper">
                    <div class="avatar-circle" aria-hidden="true">
                      {currentAvatarUrl.value
                        ? <img src={currentAvatarUrl.value} alt="" class="avatar-img" />
                        : getInitials()
                      }
                    </div>
                    <label class="avatar-upload-btn" title="Изменить фото">
                      <input
                        type="file"
                        accept="image/*"
                        class="sr-only"
                        onChange={handleAvatarChange}
                      />
                      <span aria-hidden="true">📷</span>
                    </label>
                  </div>
                ) : (
                  <div class="avatar-circle" aria-hidden="true">
                    {userStore.user?.avatar
                      ? <img src={userStore.user.avatar} alt="" class="avatar-img" />
                      : getInitials()
                    }
                  </div>
                )}
                <span class="sr-only">
                  Аватар пользователя {userStore.user?.first_name || ''} {userStore.user?.last_name || ''}
                </span>
              </div>

              <dl class="profile-info">
                <div class="info-row">
                  <dt class="info-label">Email</dt>
                  <dd class="info-value">{userEmail.value}</dd>
                </div>

                <div class="info-row">
                  <dt class="info-label">Роль</dt>
                  <dd class="info-value">
                    <span class="role-badge">{userRoleDisplay.value}</span>
                  </dd>
                </div>

                <div class="info-row">
                  <dt class="info-label">Дата регистрации</dt>
                  <dd class="info-value">{dateJoined.value}</dd>
                </div>

                {!isEditing.value && (
                  <>
                    <div class="info-row">
                      <dt class="info-label">Имя</dt>
                      <dd class="info-value">
                        {userStore.user?.first_name || 'Не указано'}
                      </dd>
                    </div>

                    <div class="info-row">
                      <dt class="info-label">Фамилия</dt>
                      <dd class="info-value">
                        {userStore.user?.last_name || 'Не указано'}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              {isEditing.value && (
                <form
                  class="profile-edit-form"
                  aria-label="Редактирование личных данных"
                  onSubmit={(e) => { e.preventDefault(); saveProfile() }}
                >
                  <UiInput
                    id="profile-first-name"
                    label="Имя"
                    modelValue={firstName.value}
                    onUpdate:modelValue={(val: string) => {
                      firstName.value = val
                      clearMessages()
                    }}
                    placeholder="Ваше имя"
                    autocomplete="given-name"
                    error={validationErrors.value?.first_name?.[0]}
                  />

                  <UiInput
                    id="profile-last-name"
                    label="Фамилия"
                    modelValue={lastName.value}
                    onUpdate:modelValue={(val: string) => {
                      lastName.value = val
                      clearMessages()
                    }}
                    placeholder="Ваша фамилия"
                    autocomplete="family-name"
                    error={validationErrors.value?.last_name?.[0]}
                  />

                  <div class="info-actions">
                    <button
                      type="submit"
                      class="btn btn--primary"
                      disabled={saving.value}
                      aria-busy={saving.value ? 'true' : undefined}
                    >
                      {saving.value ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      class="btn btn--ghost"
                      onClick={cancelEditing}
                      disabled={saving.value}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Смена пароля */}
            <section class="profile-section card" aria-labelledby="profile-security-title">
              <div class="section-header">
                <h2 id="profile-security-title" class="section-title">Безопасность</h2>
                {!showPasswordForm.value && (
                  <UiButton onClick={togglePasswordForm} variant="ghost" size="sm">
                    Изменить пароль
                  </UiButton>
                )}
              </div>

              {showPasswordForm.value ? (
                <form
                  class="password-form"
                  aria-label="Смена пароля"
                  onSubmit={(e) => { e.preventDefault(); changePassword() }}
                >
                  <UiInput
                    id="profile-old-password"
                    label="Текущий пароль"
                    type="password"
                    modelValue={oldPassword.value}
                    onUpdate:modelValue={(val: string) => {
                      oldPassword.value = val
                      clearMessages()
                    }}
                    placeholder="Введите текущий пароль"
                    autocomplete="current-password"
                    error={validationErrors.value?.old_password?.[0]}
                  />

                  <UiInput
                    id="profile-new-password"
                    label="Новый пароль"
                    type="password"
                    modelValue={newPassword.value}
                    onUpdate:modelValue={(val: string) => {
                      newPassword.value = val
                      clearMessages()
                    }}
                    placeholder="Минимум 8 символов"
                    autocomplete="new-password"
                    hint="Минимум 8 символов"
                    error={validationErrors.value?.new_password?.[0]}
                  />

                  <UiInput
                    id="profile-confirm-password"
                    label="Подтверждение пароля"
                    type="password"
                    modelValue={confirmPassword.value}
                    onUpdate:modelValue={(val: string) => {
                      confirmPassword.value = val
                      clearMessages()
                    }}
                    placeholder="Повторите новый пароль"
                    autocomplete="new-password"
                    error={
                      newPassword.value &&
                      confirmPassword.value &&
                      newPassword.value !== confirmPassword.value
                        ? 'Пароли не совпадают'
                        : ''
                    }
                  />

                  <div class="form-actions">
                    <button
                      type="submit"
                      class="btn btn--primary"
                      disabled={saving.value}
                      aria-busy={saving.value ? 'true' : undefined}
                    >
                      {saving.value ? 'Сохранение...' : 'Изменить пароль'}
                    </button>
                    <button
                      type="button"
                      class="btn btn--ghost"
                      onClick={togglePasswordForm}
                      disabled={saving.value}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <div class="security-info">
                  <p>Регулярно меняйте пароль для безопасности аккаунта</p>
                </div>
              )}
            </section>

            {/* Статистика аккаунта */}
            <section class="profile-section card" aria-labelledby="profile-account-title">
              <h2 id="profile-account-title" class="section-title">Аккаунт</h2>
              <dl class="account-stats">
                <div class="stat-row">
                  <dt class="stat-label">User ID:</dt>
                  <dd class="stat-value">{userStore.user?.id || '—'}</dd>
                </div>
                <div class="stat-row">
                  <dt class="stat-label">Роль:</dt>
                  <dd class="stat-value">{userRoleDisplay.value}</dd>
                </div>
                <div class="stat-row">
                  <dt class="stat-label">Зарегистрирован:</dt>
                  <dd class="stat-value">{dateJoined.value}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    )
  },
})
