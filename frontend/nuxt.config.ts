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
  css: ['~/assets/css/main.css'],

  // App настройки
  app: {
    head: {
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

  // Dev proxy — избегаем CORS проблем
  // Запросы на /api будут проксироваться на backend
  routeRules: {
    '/api/**': {
      proxy: 'http://localhost:8000/api/**',
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
