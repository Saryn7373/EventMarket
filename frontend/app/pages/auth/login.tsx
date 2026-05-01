import { defineComponent, ref } from 'vue'
import UiInput from '~/components/ui/Input'
import UiButton from '~/components/ui/Button'
import UiAlert from '~/components/ui/Alert'
import type { LoginPayload } from '~/utils/types'

definePageMeta({
  layout: 'auth',
})

export default defineComponent({
  name: 'LoginPage',
  setup() {
    const email = ref('')
    const password = ref('')
    const loading = ref(false)
    const error = ref('')

    const onSubmit = async () => {
      error.value = ''
      loading.value = true

      try {
        const api = useApi()
        const data = await api.post<{ access: string; refresh: string }>(
          '/auth/login/',
          { email: email.value, password: password.value } as LoginPayload
        )

        // ✅ Оба токена через единый API — один и тот же ref внутри плагина
        api.setAccessToken(data.access)
        api.setRefreshToken(data.refresh)  // ← вместо raw useCookie

        await navigateTo('/dashboard')
      } catch (err: any) {
        error.value = err.data?.detail || err.message || 'Неверный email или пароль'
      } finally {
        loading.value = false
      }
    }

    return () => (
      <section class="login-page" aria-labelledby="login-title">
        <h1 id="login-title" class="login-title">Вход в аккаунт</h1>
        <p class="login-subtitle">
          Введите свои данные для входа
        </p>

        {error.value && (
          <div class="mb-md">
            <UiAlert variant="error" title="Ошибка">
              {error.value}
            </UiAlert>
          </div>
        )}

        <form
          class="login-form"
          aria-labelledby="login-title"
          onSubmit={(e) => { e.preventDefault(); onSubmit() }}
        >
          <UiInput
            id="login-email"
            modelValue={email.value}
            onUpdate:modelValue={(val: string) => { email.value = val }}
            type="email"
            label="Email"
            placeholder="your@email.com"
            autocomplete="email"
            required
          />

          <UiInput
            id="login-password"
            modelValue={password.value}
            onUpdate:modelValue={(val: string) => { password.value = val }}
            type="password"
            label="Пароль"
            placeholder="Введите пароль"
            autocomplete="current-password"
            required
          />

          <div class="login-actions">
            <UiButton
              type="submit"
              variant="primary"
              size="lg"
              loading={loading.value}
              disabled={loading.value}
            >
              Войти
            </UiButton>
          </div>
        </form>

        <div class="login-footer">
          <p>
            Нет аккаунта?{' '}
            <a href="/auth/register">Зарегистрироваться</a>
          </p>
        </div>
      </section>
    )
  },
})
