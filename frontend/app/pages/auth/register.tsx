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
      <div class="register-step">
        <h1 class="register-title">Выберите роль</h1>
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

        <div class="role-cards">
          {roleOptions.map((option) => (
            <div
              class={[
                'role-card',
                { 'role-card--selected': role.value === option.value },
              ]}
              onClick={() => { role.value = option.value }}
            >
              <span class="role-card-icon">{option.icon}</span>
              <h3 class="role-card-label">{option.label}</h3>
              <p class="role-card-desc">{option.description}</p>
              <div class="role-card-radio">
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role.value === option.value}
                  onChange={() => { role.value = option.value }}
                />
              </div>
            </div>
          ))}
        </div>

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
      </div>
    )

    // Рендер шага 2 — Заполнение данных
    const renderStep2 = () => (
      <div class="register-step">
        {/* Навигация */}
        <div class="step-nav">
          <button class="step-back" onClick={goToStep1}>
            ← Назад
          </button>
          <span class="step-label">
            Роль: <strong>{selectedRoleInfo.value?.icon} {selectedRoleInfo.value?.label}</strong>
          </span>
        </div>

        <h1 class="register-title register-title--small">Заполните данные</h1>

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

        <form class="register-form" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
          {/* Личные данные */}
          <div class="form-section">
            <h3 class="form-section-title">Личные данные</h3>

            <div class="form-row">
              <UiInput
                modelValue={firstName.value}
                onUpdate:modelValue={(val: string) => { firstName.value = val }}
                type="text"
                label="Имя"
                placeholder="Иван"
                required
              />

              <UiInput
                modelValue={lastName.value}
                onUpdate:modelValue={(val: string) => { lastName.value = val }}
                type="text"
                label="Фамилия"
                placeholder="Иванов"
                required
              />
            </div>

            <UiInput
              modelValue={email.value}
              onUpdate:modelValue={(val: string) => { email.value = val }}
              type="email"
              label="Email"
              placeholder="your@email.com"
              required
            />

            <div class="form-row">
              <UiInput
                modelValue={password.value}
                onUpdate:modelValue={(val: string) => { password.value = val }}
                type="password"
                label="Пароль"
                placeholder="Минимум 8 символов"
                required
              />

              <UiInput
                modelValue={passwordConfirm.value}
                onUpdate:modelValue={(val: string) => { passwordConfirm.value = val }}
                type="password"
                label="Подтверждение пароля"
                placeholder="Повторите пароль"
                error={passwordError.value}
                required
              />
            </div>
          </div>

          {/* Поля для специалиста */}
          {role.value === 'specialist' && (
            <div class="form-section form-section--highlight">
              <h3 class="form-section-title">🎯 Данные специалиста</h3>

              <UiSelect
                modelValue={specialty.value}
                onUpdate:modelValue={(val: string) => { specialty.value = val }}
                label="Специализация"
                options={specialtyOptions}
                placeholder="Выберите специализацию"
                required
              />

              <UiInput
                modelValue={licenseNumber.value}
                onUpdate:modelValue={(val: string) => { licenseNumber.value = val }}
                type="text"
                label="Номер лицензии"
                placeholder="Необязательно"
              />

              <UiInput
                modelValue={portfolioUrl.value}
                onUpdate:modelValue={(val: string) => { portfolioUrl.value = val }}
                type="text"
                label="Ссылка на портфолио"
                placeholder="https://example.com/portfolio"
              />
            </div>
          )}

          {/* Поля для владельца площадки */}
          {role.value === 'owner' && (
            <div class="form-section form-section--highlight">
              <h3 class="form-section-title">🏛️ Данные владельца</h3>

              <UiInput
                modelValue={inn.value}
                onUpdate:modelValue={(val: string) => { inn.value = val }}
                type="text"
                label="ИНН / ЕГРН"
                placeholder="Необязательно"
              />
            </div>
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
      </div>
    )

    return () => (
      <div class="register-page">
        {step.value === 1 ? renderStep1() : renderStep2()}
      </div>
    )
  },
})
