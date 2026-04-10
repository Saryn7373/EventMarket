import { defineComponent, ref, computed, onMounted } from 'vue'
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

    const enableEditing = () => {
      isEditing.value = true
      firstName.value = userStore.user?.first_name || ''
      lastName.value = userStore.user?.last_name || ''
      clearMessages()
    }

    const cancelEditing = () => {
      isEditing.value = false
      clearMessages()
    }

    const saveProfile = async () => {
      saving.value = true
      clearMessages()
      validationErrors.value = {}

      try {
        await $api.patch<User>(API_ENDPOINTS.auth.me, {
          first_name: firstName.value,
          last_name: lastName.value,
        })

        // Обновляем store
        userStore.updateName(firstName.value, lastName.value)

        successMessage.value = 'Профиль успешно обновён'
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

    return () => (
      <div class="profile-page">
        <div class="container">
          <div class="profile-header">
            <h1 class="profile-title">Профиль</h1>
            <p class="profile-subtitle">Управление личными данными</p>
          </div>

          {/* Сообщения */}
          {successMessage.value && (
            <UiAlert variant="success" title={successMessage.value} />
          )}
          {errorMessage.value && (
            <UiAlert variant="error" title={errorMessage.value} />
          )}

          <div class="profile-content">
            {/* Основная информация */}
            <div class="profile-section card">
              <div class="section-header">
                <h2 class="section-title">Личная информация</h2>
                {!isEditing.value && (
                  <UiButton onClick={enableEditing} variant="ghost" size="sm">
                    Редактировать
                  </UiButton>
                )}
              </div>

              <div class="profile-avatar">
                <div class="avatar-circle">
                  {getInitials()}
                </div>
              </div>

              <div class="profile-info">
                <div class="info-row">
                  <label class="info-label">Email</label>
                  <div class="info-value">{userEmail.value}</div>
                </div>

                <div class="info-row">
                  <label class="info-label">Роль</label>
                  <div class="info-value">
                    <span class="role-badge">{userRoleDisplay.value}</span>
                  </div>
                </div>

                <div class="info-row">
                  <label class="info-label">Дата регистрации</label>
                  <div class="info-value">{dateJoined.value}</div>
                </div>

                <div class="info-divider"></div>

                {isEditing.value ? (
                  <>
                    <div class="info-row info-row--edit">
                      <UiInput
                        label="Имя"
                        modelValue={firstName.value}
                        onUpdate:modelValue={(val: string) => {
                          firstName.value = val
                          clearMessages()
                        }}
                        placeholder="Ваше имя"
                        error={validationErrors.value?.first_name?.[0]}
                      />
                    </div>

                    <div class="info-row info-row--edit">
                      <UiInput
                        label="Фамилия"
                        modelValue={lastName.value}
                        onUpdate:modelValue={(val: string) => {
                          lastName.value = val
                          clearMessages()
                        }}
                        placeholder="Ваша фамилия"
                        error={validationErrors.value?.last_name?.[0]}
                      />
                    </div>

                    <div class="info-actions">
                      <button
                        class="btn btn--primary"
                        onClick={saveProfile}
                        disabled={saving.value}
                      >
                        {saving.value ? 'Сохранение...' : 'Сохранить'}
                      </button>
                      <button
                        class="btn btn--ghost"
                        onClick={cancelEditing}
                        disabled={saving.value}
                      >
                        Отмена
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div class="info-row">
                      <label class="info-label">Имя</label>
                      <div class="info-value">
                        {userStore.user?.first_name || 'Не указано'}
                      </div>
                    </div>

                    <div class="info-row">
                      <label class="info-label">Фамилия</label>
                      <div class="info-value">
                        {userStore.user?.last_name || 'Не указано'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Смена пароля */}
            <div class="profile-section card">
              <div class="section-header">
                <h2 class="section-title">Безопасность</h2>
                {!showPasswordForm.value && (
                  <UiButton onClick={togglePasswordForm} variant="ghost" size="sm">
                    Изменить пароль
                  </UiButton>
                )}
              </div>

              {showPasswordForm.value ? (
                <div class="password-form">
                  <div class="form-group">
                    <UiInput
                      label="Текущий пароль"
                      type="password"
                      modelValue={oldPassword.value}
                      onUpdate:modelValue={(val: string) => {
                        oldPassword.value = val
                        clearMessages()
                      }}
                      placeholder="Введите текущий пароль"
                      error={validationErrors.value?.old_password?.[0]}
                    />
                  </div>

                  <div class="form-group">
                    <UiInput
                      label="Новый пароль"
                      type="password"
                      modelValue={newPassword.value}
                      onUpdate:modelValue={(val: string) => {
                        newPassword.value = val
                        clearMessages()
                      }}
                      placeholder="Минимум 8 символов"
                      error={validationErrors.value?.new_password?.[0]}
                    />
                  </div>

                  <div class="form-group">
                    <UiInput
                      label="Подтверждение пароля"
                      type="password"
                      modelValue={confirmPassword.value}
                      onUpdate:modelValue={(val: string) => {
                        confirmPassword.value = val
                        clearMessages()
                      }}
                      placeholder="Повторите новый пароль"
                    />
                    {newPassword.value &&
                      confirmPassword.value &&
                      newPassword.value !== confirmPassword.value && (
                        <div class="field-error">Пароли не совпадают</div>
                      )}
                  </div>

                  <div class="form-actions">
                    <button
                      class="btn btn--primary"
                      onClick={changePassword}
                      disabled={saving.value}
                    >
                      {saving.value ? 'Сохранение...' : 'Изменить пароль'}
                    </button>
                    <button
                      class="btn btn--ghost"
                      onClick={togglePasswordForm}
                      disabled={saving.value}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div class="security-info">
                  <p>Регулярно меняйте пароль для безопасности аккаунта</p>
                </div>
              )}
            </div>

            {/* Статистика аккаунта */}
            <div class="profile-section card">
              <h2 class="section-title">Аккаунт</h2>
              <div class="account-stats">
                <div class="stat-row">
                  <span class="stat-label">User ID:</span>
                  <span class="stat-value">{userStore.user?.id || '—'}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Роль:</span>
                  <span class="stat-value">{userRoleDisplay.value}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Зарегистрирован:</span>
                  <span class="stat-value">{dateJoined.value}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
})
