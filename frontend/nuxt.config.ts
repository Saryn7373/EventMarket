// https://nuxt.com/docs/api/configuration/nuxt-config
declare const process: { env: Record<string, string | undefined> }

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Модули
  modules: [
    '@pinia/nuxt',
  ],

  // CSS
  // Все стили перечислены здесь, чтобы они попадали в инициальный HTML
  // и не было FOUC при жёсткой перезагрузке (CSS-импорты из TSX-файлов
  // Nuxt inline-стилями SSR не всегда подхватывает, в отличие от .vue SFC).
  // Сами файлы по-прежнему лежат рядом со своими компонентами/страницами.
  css: [
    '~/assets/css/main.css',
    '~/layouts/default.css',
    '~/layouts/auth.css',
    '~/pages/index.css',
    '~/pages/auth/login.css',
    '~/pages/auth/register.css',
    '~/pages/dashboard/index.css',
    '~/components/AdminPanel.css',
    '~/pages/profile/index.css',
    '~/pages/events/[id].css',
    '~/pages/venues/index.css',
    '~/pages/venues/[slug].css',
    '~/pages/specialists/index.css',
    '~/pages/specialists/[id].css',
    '~/components/ui/Button.css',
    '~/components/ui/Input.css',
    '~/components/ui/Select.css',
    '~/components/ui/Alert.css',
    '~/components/ui/Dialog.css',
  ],

  // App настройки
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'EventMarket',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Платформа аренды площадок и найма специалистов для мероприятий' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  // Runtime config
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
      apiPrefix: '/api',
    },
  },

  // Dev сервер
  devServer: {
    port: 3000,
  },

  // Прокси для Nitro-сервера (SSR + client в prod)
  // В Docker: NUXT_INTERNAL_API_URL=http://backend:8000 (build arg)
  // Локально: http://localhost:8000 (по умолчанию)
  routeRules: {
    '/api/**': {
      proxy: `${process.env.NUXT_INTERNAL_API_URL || 'http://localhost:8000'}/api/**`,
    },
    '/media/**': {
      proxy: `${process.env.NUXT_INTERNAL_API_URL || 'http://localhost:8000'}/media/**`,
    },
  },

  // Vite proxy (для Nuxt 3)
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/media': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  },

  // TypeScript
  typescript: {
    strict: true,
  },

  // Игнорировать файлы при сборке
  ignore: [
    '**/*.test.ts',
    '**/*.stories.tsx',
  ],
})
