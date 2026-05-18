import { defineComponent, ref, computed } from 'vue'
import UiInput from '~/components/ui/Input'
import UiSelect from '~/components/ui/Select'
import UiButton from '~/components/ui/Button'
import UiAlert from '~/components/ui/Alert'
import type { SelectOption } from '~/components/ui/Select'
import type { RegisterPayload } from '~/utils/types'

definePageMeta({
  layout: 'auth',
})

export default defineComponent({
  name: 'RegisterPage',
  setup() {
    // Шаг регистрации
    const step = ref(1)

    // Выбранная роль
    const role = ref('')

    // Основные поля
    const email = ref('')
    const password = ref('')
    const passwordConfirm = ref('')
    const firstName = ref('')
    const lastName = ref('')

    // Специфичные поля для ролей
    const portfolioUrl = ref('')
    const specialty = ref('')
    const licenseNumber = ref('')
    const inn = ref('')

    // Аватар
    const avatarFile = ref<File | null>(null)
    const avatarPreview = ref<string | null>(null)

    const handleAvatarChange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
      avatarFile.value = file
      avatarPreview.value = URL.createObjectURL(file)
    }

    // Состояние
    const loading = ref(false)
    const error = ref('')
    const success = ref('')

    // Опции ролей
    const roleOptions: SelectOption[] = [
      {
        value: 'renter',
        label: 'Арендатор',
        icon: '🎉',
        description: 'Создавайте мероприятия, бронируйте площадки и нанимайте специалистов',
      },
      {
        value: 'owner',
        label: 'Владелец площадки',
        icon: '🏛️',
        description: 'Сдавайте площадки в аренду и управляйте бронированиями',
      },
      {
        value: 'specialist',
        label: 'Специалист',
        icon: '🎯',
        description: 'Предоставляйте услуги: фотограф, DJ, ведущий, декоратор и др.',
      },
    ]

    // Специфичные опции для специалиста
    const specialtyOptions: SelectOption[] = [
      { value: 'Фотограф', label: '📸 Фотограф' },
      { value: 'DJ', label: '🎵 DJ' },
      { value: 'Ведущий', label: '🎤 Ведущий' },
      { value: 'Декоратор', label: '🎨 Декоратор' },
      { value: 'Кейтеринг', label: '🍽️ Кейтеринг' },
      { value: 'Видеограф', label: '🎥 Видеограф' },
      { value: 'Звукорежиссёр', label: '🔊 Звукорежиссёр' },
      { value: 'Другое', label: '📌 Другое' },
    ]

    // Информация о выбранной роли
    const selectedRoleInfo = computed(() =>
      roleOptions.find((opt) => opt.value === role.value)
    )

    // Валидация шага 1
    const isStep1Valid = computed(() => !!role.value)

    // Валидация шага 2
    const passwordError = computed(() => {
      if (passwordConfirm.value && password.value !== passwordConfirm.value) {
        return 'Пароли не совпадают'
      }
      return ''
    })

    const isStep2Valid = computed(() => {
      const baseValid = !!(
        email.value &&
        password.value &&
        passwordConfirm.value &&
        firstName.value &&
        lastName.value &&
        password.value === passwordConfirm.value
      )

      if (role.value === 'specialist') {
        return baseValid && !!specialty.value
      }

      return baseValid
    })

    // Переход на шаг 2
    const goToStep2 = () => {
      if (!isStep1Valid.value) {
        error.value = 'Пожалуйста, выберите роль'
        return
      }
      error.value = ''
      step.value = 2
    }

    // Возврат на шаг 1
    const goToStep1 = () => {
      step.value = 1
      error.value = ''
    }

    // Отправка формы
    const onSubmit = async () => {
      error.value = ''
      success.value = ''

      if (!isStep2Valid.value) {
        error.value = 'Пожалуйста, заполните все обязательные поля'
        return
      }

      loading.value = true

      try {
        const api = useApi()

        const payload: RegisterPayload = {
          email: email.value,
          password: password.value,
          password_confirm: passwordConfirm.value,
          first_name: firstName.value,
          last_name: lastName.value,
          role: role.value as 'renter' | 'owner' | 'specialist',
        }

        // Добавляем специфичные поля
        if (role.value === 'specialist') {
          Object.assign(payload, {
            specialty: specialty.value,
            license_number: licenseNumber.value || undefined,
            portfolio_url: portfolioUrl.value || undefined,
          })
        }

        if (role.value === 'owner') {
          Object.assign(payload, {
            inn: inn.value || undefined,
          })
        }

        const data = await api.post<{
          user: any
          access: string
          refresh: string
        }>('/auth/register/', payload)

        // Сохраняем токены через единый API
        api.setAccessToken(data.access)
        useCookie<string | null>('refresh_token', { maxAge: 60 * 60 * 24 * 7, path: '/' }).value = data.refresh

        // Загружаем аватар если выбран
        if (avatarFile.value) {
          try {
            const fd = new FormData()
            fd.append('avatar', avatarFile.value)
            await api.patchForm('/auth/me/', fd)
          } catch {
            // Некритичная ошибка — продолжаем
          }
        }

        success.value = 'Регистрация успешна! Перенаправляем...'

        // Редирект в дашборд
        setTimeout(async () => {
          await navigateTo('/dashboard')
        }, 1000)
      } catch (err: any) {
        error.value = err.data?.detail || err.message || 'Ошибка при регистрации'
      } finally {
        loading.value = false
      }
    }

    // Рендер шага 1 — Выбор роли
    const renderStep1 = () => (
      <section class="register-step" aria-labelledby="register-title-step1">
        <h1 id="register-title-step1" class="register-title">Выберите роль</h1>
        <p class="register-subtitle">
          Как вы планируете использовать EventMarket?
        </p>

        {error.value && (
          <div class="mb-md">
            <UiAlert variant="error" title="Ошибка">
              {error.value}
            </UiAlert>
          </div>
        )}

        <fieldset class="role-fieldset">
          <legend class="sr-only">Роль на платформе</legend>
          <ul class="role-cards">
            {roleOptions.map((option) => {
              const inputId = `role-${option.value}`
              const descId = `role-${option.value}-desc`
              const isSelected = role.value === option.value
              return (
                <li>
                  <label
                    class={['role-card', { 'role-card--selected': isSelected }]}
                    for={inputId}
                  >
                    <input
                      id={inputId}
                      class="role-card-input sr-only"
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={isSelected}
                      aria-describedby={descId}
                      onChange={() => { role.value = option.value }}
                    />
                    <span class="role-card-icon" aria-hidden="true">{option.icon}</span>
                    <span class="role-card-text">
                      <span class="role-card-label">{option.label}</span>
                      <span class="role-card-desc" id={descId}>{option.description}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <div class="register-actions">
          <button
            type="button"
            class="btn btn--primary btn--lg"
            disabled={!isStep1Valid.value}
            onClick={goToStep2}
          >
            Далее
          </button>
        </div>

        <div class="register-footer">
          <p>
            Уже есть аккаунт?{' '}
            <a href="/auth/login">Войти</a>
          </p>
        </div>
      </section>
    )

    // Рендер шага 2 — Заполнение данных
    const renderStep2 = () => (
      <section class="register-step" aria-labelledby="register-title-step2">
        {/* Навигация */}
        <div class="step-nav">
          <button type="button" class="step-back" onClick={goToStep1}>
            <span aria-hidden="true">←</span> Назад
            <span class="sr-only"> к выбору роли</span>
          </button>
          <span class="step-label">
            Роль:{' '}
            <strong>
              <span aria-hidden="true">{selectedRoleInfo.value?.icon} </span>
              {selectedRoleInfo.value?.label}
            </strong>
          </span>
        </div>

        <h1 id="register-title-step2" class="register-title register-title--small">
          Заполните данные
        </h1>

        {error.value && (
          <div class="mb-md">
            <UiAlert variant="error" title="Ошибка">
              {error.value}
            </UiAlert>
          </div>
        )}

        {success.value && (
          <div class="mb-md">
            <UiAlert variant="success" title="Успех">
              {success.value}
            </UiAlert>
          </div>
        )}

        {/* Аватар */}
        <div class="reg-avatar-section">
          <div class="reg-avatar-circle">
            {avatarPreview.value
              ? <img src={avatarPreview.value} alt="" class="reg-avatar-img" />
              : <span aria-hidden="true" class="reg-avatar-placeholder">👤</span>
            }
          </div>
          <label class="btn btn--ghost btn--sm reg-avatar-btn">
            <input
              type="file"
              accept="image/*"
              class="sr-only"
              onChange={handleAvatarChange}
            />
            {avatarFile.value ? 'Изменить фото' : 'Добавить фото профиля'}
          </label>
          <p class="reg-avatar-hint">Необязательно</p>
        </div>

        <form
          class="register-form"
          aria-labelledby="register-title-step2"
          onSubmit={(e) => { e.preventDefault(); onSubmit() }}
        >
          {/* Личные данные */}
          <fieldset class="form-section">
            <legend class="form-section-title">Личные данные</legend>

            <div class="form-row">
              <UiInput
                id="reg-first-name"
                modelValue={firstName.value}
                onUpdate:modelValue={(val: string) => { firstName.value = val }}
                type="text"
                label="Имя"
                placeholder="Иван"
                autocomplete="given-name"
                required
              />

              <UiInput
                id="reg-last-name"
                modelValue={lastName.value}
                onUpdate:modelValue={(val: string) => { lastName.value = val }}
                type="text"
                label="Фамилия"
                placeholder="Иванов"
                autocomplete="family-name"
                required
              />
            </div>

            <UiInput
              id="reg-email"
              modelValue={email.value}
              onUpdate:modelValue={(val: string) => { email.value = val }}
              type="email"
              label="Email"
              placeholder="your@email.com"
              autocomplete="email"
              required
            />

            <div class="form-row">
              <UiInput
                id="reg-password"
                modelValue={password.value}
                onUpdate:modelValue={(val: string) => { password.value = val }}
                type="password"
                label="Пароль"
                placeholder="Минимум 8 символов"
                autocomplete="new-password"
                required
              />

              <UiInput
                id="reg-password-confirm"
                modelValue={passwordConfirm.value}
                onUpdate:modelValue={(val: string) => { passwordConfirm.value = val }}
                type="password"
                label="Повтор пароля"
                placeholder="Повторите пароль"
                autocomplete="new-password"
                error={passwordError.value}
                required
              />
            </div>
          </fieldset>

          {/* Поля для специалиста */}
          {role.value === 'specialist' && (
            <fieldset class="form-section form-section--highlight">
              <legend class="form-section-title">
                <span aria-hidden="true">🎯</span> Данные специалиста
              </legend>

              <UiSelect
                id="reg-specialty"
                modelValue={specialty.value}
                onUpdate:modelValue={(val: string) => { specialty.value = val }}
                label="Специализация"
                options={specialtyOptions}
                placeholder="Выберите специализацию"
                required
              />

              <UiInput
                id="reg-license"
                modelValue={licenseNumber.value}
                onUpdate:modelValue={(val: string) => { licenseNumber.value = val }}
                type="text"
                label="Номер лицензии"
                placeholder="Необязательно"
              />

              <UiInput
                id="reg-portfolio"
                modelValue={portfolioUrl.value}
                onUpdate:modelValue={(val: string) => { portfolioUrl.value = val }}
                type="text"
                label="Ссылка на портфолио"
                placeholder="https://example.com/portfolio"
                autocomplete="url"
              />
            </fieldset>
          )}

          {/* Поля для владельца площадки */}
          {role.value === 'owner' && (
            <fieldset class="form-section form-section--highlight">
              <legend class="form-section-title">
                <span aria-hidden="true">🏛️</span> Данные владельца
              </legend>

              <UiInput
                id="reg-inn"
                modelValue={inn.value}
                onUpdate:modelValue={(val: string) => { inn.value = val }}
                type="text"
                label="ИНН / ЕГРН"
                placeholder="Необязательно"
              />
            </fieldset>
          )}

          {/* Кнопка отправки */}
          <div class="register-actions">
            <UiButton
              type="submit"
              variant="primary"
              size="lg"
              loading={loading.value}
              disabled={loading.value || !isStep2Valid.value}
            >
              Зарегистрироваться
            </UiButton>
          </div>
        </form>

        <div class="register-footer">
          <p>
            Уже есть аккаунт?{' '}
            <a href="/auth/login">Войти</a>
          </p>
        </div>
      </section>
    )

    return () => (
      <div class="register-page">
        {step.value === 1 ? renderStep1() : renderStep2()}
      </div>
    )
  },
})
