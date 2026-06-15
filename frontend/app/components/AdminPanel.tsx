import { defineComponent, computed, onMounted, ref } from 'vue'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import {
  API_ENDPOINTS,
  REVIEW_STATUS,
  REVIEW_STATUS_COLORS,
} from '~/utils/constants'
import type {
  AdminUserItem,
  AdminReview,
  AdminAnalytics,
  ReviewStatus,
} from '~/utils/types'
import UiDialog from '~/components/ui/Dialog'
import UiAlert from '~/components/ui/Alert'

type Tab = 'users' | 'reviews' | 'analytics'

export default defineComponent({
  name: 'AdminPanel',
  setup() {
    const userStore = useUserStore()
    const $api = useApi()

    const activeTab = ref<Tab>('users')

    // ── Пользователи ──
    const users = ref<AdminUserItem[]>([])
    const usersLoading = ref(false)
    const usersError = ref<string | null>(null)
    const search = ref('')
    const usersCount = ref(0)
    const page = ref(1)
    const pageSize = 20

    const deleteOpen = ref(false)
    const deleteTarget = ref<AdminUserItem | null>(null)
    const deleteSubmitting = ref(false)
    const deleteError = ref('')

    const grantOpen = ref(false)
    const grantTarget = ref<AdminUserItem | null>(null)
    const grantSubmitting = ref(false)
    const grantError = ref('')

    // ── Отзывы ──
    const reviews = ref<AdminReview[]>([])
    const reviewsLoading = ref(false)
    const reviewsError = ref<string | null>(null)
    const reviewStatus = ref<ReviewStatus>('pending')
    const moderatingId = ref<string | null>(null)

    // ── Аналитика ──
    const analytics = ref<AdminAnalytics | null>(null)
    const analyticsLoading = ref(false)
    const analyticsError = ref<string | null>(null)

    const myId = computed(() => userStore.user?.id ?? '')
    const totalPages = computed(() => Math.ceil(usersCount.value / pageSize))

    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

    // ─────────────────────────── Пользователи ───────────────────────────

    const loadUsers = async () => {
      usersLoading.value = true
      usersError.value = null
      try {
        const params: Record<string, any> = { page: page.value, page_size: pageSize }
        if (search.value.trim()) params.search = search.value.trim()
        const res = await $api.get<{ results: AdminUserItem[]; count: number }>(
          API_ENDPOINTS.admin.users,
          { params },
        )
        users.value = res.results ?? []
        usersCount.value = res.count ?? 0
      } catch (e: any) {
        usersError.value = e.data?.detail || e.message || 'Не удалось загрузить пользователей'
      } finally {
        usersLoading.value = false
      }
    }

    const onSearch = () => { page.value = 1; loadUsers() }
    const goToPage = (p: number) => { page.value = p; loadUsers() }

    const openDelete = (u: AdminUserItem) => {
      deleteTarget.value = u
      deleteError.value = ''
      deleteOpen.value = true
    }
    const closeDelete = () => { deleteOpen.value = false; deleteTarget.value = null }

    const submitDelete = async () => {
      if (!deleteTarget.value) return
      deleteSubmitting.value = true
      deleteError.value = ''
      try {
        await $api.delete(API_ENDPOINTS.admin.userDetail(deleteTarget.value.id))
        users.value = users.value.filter(u => u.id !== deleteTarget.value!.id)
        usersCount.value = Math.max(0, usersCount.value - 1)
        closeDelete()
      } catch (e: any) {
        deleteError.value = e.data?.detail || e.message || 'Не удалось удалить пользователя'
      } finally {
        deleteSubmitting.value = false
      }
    }

    const openGrant = (u: AdminUserItem) => {
      grantTarget.value = u
      grantError.value = ''
      grantOpen.value = true
    }
    const closeGrant = () => { grantOpen.value = false; grantTarget.value = null }

    const submitGrant = async () => {
      if (!grantTarget.value) return
      grantSubmitting.value = true
      grantError.value = ''
      try {
        const updated = await $api.post<AdminUserItem>(
          API_ENDPOINTS.admin.grantAdmin(grantTarget.value.id),
        )
        const idx = users.value.findIndex(u => u.id === updated.id)
        if (idx >= 0) users.value[idx] = updated
        closeGrant()
      } catch (e: any) {
        grantError.value = e.data?.detail || e.message || 'Не удалось выдать права'
      } finally {
        grantSubmitting.value = false
      }
    }

    // ─────────────────────────── Отзывы ───────────────────────────

    const loadReviews = async () => {
      reviewsLoading.value = true
      reviewsError.value = null
      try {
        reviews.value = await $api.get<AdminReview[]>(API_ENDPOINTS.reviews.adminList, {
          params: { status: reviewStatus.value },
        })
      } catch (e: any) {
        reviewsError.value = e.data?.detail || e.message || 'Не удалось загрузить отзывы'
      } finally {
        reviewsLoading.value = false
      }
    }

    const moderate = async (r: AdminReview, action: 'approve' | 'reject') => {
      moderatingId.value = r.id
      try {
        const endpoint = r.type === 'venue'
          ? API_ENDPOINTS.reviews.adminModerateVenue(r.id)
          : API_ENDPOINTS.reviews.adminModerateSpecialist(r.id)
        await $api.post(endpoint, { action })
        // Убираем отзыв из текущего списка (он сменил статус)
        reviews.value = reviews.value.filter(x => x.id !== r.id)
      } catch (e: any) {
        reviewsError.value = e.data?.detail || e.message || 'Ошибка модерации'
      } finally {
        moderatingId.value = null
      }
    }

    // ─────────────────────────── Аналитика ───────────────────────────

    const loadAnalytics = async () => {
      analyticsLoading.value = true
      analyticsError.value = null
      try {
        analytics.value = await $api.get<AdminAnalytics>(API_ENDPOINTS.admin.analytics)
      } catch (e: any) {
        analyticsError.value = e.data?.detail || e.message || 'Не удалось загрузить аналитику'
      } finally {
        analyticsLoading.value = false
      }
    }

    // ── Переключение вкладок (ленивая загрузка) ──
    const switchTab = (tab: Tab) => {
      activeTab.value = tab
      if (tab === 'users' && users.value.length === 0) loadUsers()
      if (tab === 'reviews' && reviews.value.length === 0) loadReviews()
      if (tab === 'analytics' && !analytics.value) loadAnalytics()
    }

    onMounted(loadUsers)

    // ─────────────────────────── Рендер вкладок ───────────────────────────

    const renderUsers = () => (
      <section aria-labelledby="admin-users-title">
        <form
          class="admin-search"
          role="search"
          onSubmit={(e) => { e.preventDefault(); onSearch() }}
        >
          <input
            type="search"
            class="input"
            placeholder="Поиск по email или имени…"
            value={search.value}
            onInput={(e) => { search.value = (e.target as HTMLInputElement).value }}
          />
          <button type="submit" class="btn btn--primary">Найти</button>
        </form>

        {usersLoading.value && (
          <div class="empty-state" role="status"><div class="spinner" aria-hidden="true" /><p>Загрузка…</p></div>
        )}

        {!usersLoading.value && usersError.value && (
          <UiAlert variant="error" title="Ошибка">{usersError.value}</UiAlert>
        )}

        {!usersLoading.value && !usersError.value && (
          <>
            <p class="results-info">Всего пользователей: {usersCount.value}</p>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Имя</th>
                    <th scope="col">Роль</th>
                    <th scope="col">Регистрация</th>
                    <th scope="col">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.value.map((u) => {
                    const isSelf = u.id === myId.value
                    return (
                      <tr key={u.id}>
                        <td><strong>{u.email}</strong>{isSelf && <span class="muted text-sm"> (вы)</span>}</td>
                        <td>{`${u.first_name} ${u.last_name}`.trim() || '—'}</td>
                        <td><span class={`badge badge--${u.is_admin ? 'red' : 'gray'}`}>{u.role_display}</span></td>
                        <td>{formatDate(u.date_joined)}</td>
                        <td class="booking-actions-cell">
                          <div class="booking-actions">
                            {!u.is_admin && (
                              <button
                                type="button"
                                class="btn btn--primary btn--sm"
                                onClick={() => openGrant(u)}
                              >
                                Выдать права администратора
                              </button>
                            )}
                            {!isSelf && !u.is_superuser && (
                              <button
                                type="button"
                                class="btn btn--danger btn--sm"
                                onClick={() => openDelete(u)}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages.value > 1 && (
              <nav class="pagination" aria-label="Страницы">
                <button
                  type="button"
                  class="btn btn--sm btn--outline"
                  disabled={page.value === 1}
                  onClick={() => goToPage(page.value - 1)}
                >← Назад</button>
                <span class="pagination-info">Страница {page.value} из {totalPages.value}</span>
                <button
                  type="button"
                  class="btn btn--sm btn--outline"
                  disabled={page.value === totalPages.value}
                  onClick={() => goToPage(page.value + 1)}
                >Вперёд →</button>
              </nav>
            )}
          </>
        )}
      </section>
    )

    const renderReviews = () => (
      <section aria-labelledby="admin-reviews-title">
        <div class="admin-filters">
          {(['pending', 'approved', 'rejected'] as ReviewStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              class={['btn', 'btn--sm', reviewStatus.value === s ? 'btn--primary' : 'btn--outline']}
              onClick={() => { reviewStatus.value = s; loadReviews() }}
            >
              {REVIEW_STATUS[s]}
            </button>
          ))}
        </div>

        {reviewsLoading.value && (
          <div class="empty-state" role="status"><div class="spinner" aria-hidden="true" /><p>Загрузка…</p></div>
        )}

        {!reviewsLoading.value && reviewsError.value && (
          <UiAlert variant="error" title="Ошибка">{reviewsError.value}</UiAlert>
        )}

        {!reviewsLoading.value && !reviewsError.value && reviews.value.length === 0 && (
          <div class="empty-state"><p>Отзывов со статусом «{REVIEW_STATUS[reviewStatus.value]}» нет.</p></div>
        )}

        {!reviewsLoading.value && !reviewsError.value && reviews.value.length > 0 && (
          <ul class="admin-review-list">
            {reviews.value.map((r) => (
              <li key={r.id} class="admin-review card">
                <div class="admin-review__head">
                  <span class="admin-review__type">
                    {r.type === 'venue' ? '🏛️ Площадка' : '🧑‍🔧 Специалист'}: <strong>{r.target}</strong>
                  </span>
                  <span class="admin-review__rating" aria-label={`Оценка ${r.rating} из 5`}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </span>
                </div>
                <p class="admin-review__author">Автор: {r.author} · {formatDate(r.created_at)}</p>
                {r.comment && <p class="admin-review__comment">{r.comment}</p>}
                <div class="admin-review__actions">
                  <span class={`badge badge--${REVIEW_STATUS_COLORS[r.status]}`}>{REVIEW_STATUS[r.status]}</span>
                  {r.status !== 'approved' && (
                    <button
                      type="button"
                      class="btn btn--primary btn--sm"
                      disabled={moderatingId.value === r.id}
                      onClick={() => moderate(r, 'approve')}
                    >Опубликовать</button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      type="button"
                      class="btn btn--danger btn--sm"
                      disabled={moderatingId.value === r.id}
                      onClick={() => moderate(r, 'reject')}
                    >Отклонить</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    )

    const renderAnalytics = () => (
      <section aria-labelledby="admin-analytics-title">
        {analyticsLoading.value && (
          <div class="empty-state" role="status"><div class="spinner" aria-hidden="true" /><p>Загрузка…</p></div>
        )}

        {!analyticsLoading.value && analyticsError.value && (
          <UiAlert variant="error" title="Ошибка">{analyticsError.value}</UiAlert>
        )}

        {!analyticsLoading.value && !analyticsError.value && analytics.value && (
          <div class="admin-analytics-grid">
            <div class="card admin-analytics-block">
              <h3 class="section-title">🏛️ Популярные площадки</h3>
              <p class="muted text-sm">По количеству завершённых бронирований</p>
              {analytics.value.top_venues.length === 0
                ? <div class="empty-state"><p>Нет завершённых бронирований.</p></div>
                : (
                  <table class="data-table">
                    <thead><tr><th scope="col">#</th><th scope="col">Площадка</th><th scope="col">Город</th><th scope="col">Брони</th></tr></thead>
                    <tbody>
                      {analytics.value.top_venues.map((v, i) => (
                        <tr key={v.id}>
                          <td>{i + 1}</td>
                          <td><a class="venue-card-link" href={`/venues/${v.slug}`}>{v.name}</a></td>
                          <td>{v.city}</td>
                          <td class="text-semibold">{v.completed_bookings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>

            <div class="card admin-analytics-block">
              <h3 class="section-title">🧑‍🔧 Популярные специалисты</h3>
              <p class="muted text-sm">По количеству завершённых наймов</p>
              {analytics.value.top_specialists.length === 0
                ? <div class="empty-state"><p>Нет завершённых наймов.</p></div>
                : (
                  <table class="data-table">
                    <thead><tr><th scope="col">#</th><th scope="col">Специалист</th><th scope="col">Специализация</th><th scope="col">Наймы</th></tr></thead>
                    <tbody>
                      {analytics.value.top_specialists.map((s, i) => (
                        <tr key={s.id}>
                          <td>{i + 1}</td>
                          <td><a class="venue-card-link" href={`/specialists/${s.id}`}>{`${s.first_name} ${s.last_name}`.trim()}</a></td>
                          <td>{s.specialty || '—'}</td>
                          <td class="text-semibold">{s.completed_hires}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          </div>
        )}
      </section>
    )

    return () => (
      <div class="admin-panel">
        <div class="admin-tabs" role="tablist" aria-label="Разделы администрирования">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.value === 'users'}
            class={['admin-tab', activeTab.value === 'users' && 'admin-tab--active']}
            onClick={() => switchTab('users')}
          >Пользователи</button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.value === 'reviews'}
            class={['admin-tab', activeTab.value === 'reviews' && 'admin-tab--active']}
            onClick={() => switchTab('reviews')}
          >Модерация отзывов</button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.value === 'analytics'}
            class={['admin-tab', activeTab.value === 'analytics' && 'admin-tab--active']}
            onClick={() => switchTab('analytics')}
          >Аналитика</button>
        </div>

        {activeTab.value === 'users' && renderUsers()}
        {activeTab.value === 'reviews' && renderReviews()}
        {activeTab.value === 'analytics' && renderAnalytics()}

        {/* ── Диалог удаления пользователя ── */}
        <UiDialog open={deleteOpen.value} title="Удалить пользователя?" size="sm" onClose={closeDelete}>
          {{
            default: () => (
              <div class="ep-cancel-confirm">
                <p class="ep-cancel-confirm__text">
                  Вы уверены, что хотите удалить пользователя <strong>{deleteTarget.value?.email}</strong>?
                  Это действие необратимо — все связанные данные будут удалены.
                </p>
                {deleteError.value && (
                  <div class="ecf__alert"><UiAlert variant="error" title="Ошибка">{deleteError.value}</UiAlert></div>
                )}
              </div>
            ),
            footer: () => (
              <>
                <button type="button" class="btn btn--secondary" onClick={closeDelete} disabled={deleteSubmitting.value}>Отмена</button>
                <button
                  type="button"
                  class="btn btn--danger"
                  onClick={submitDelete}
                  disabled={deleteSubmitting.value}
                  aria-busy={deleteSubmitting.value ? 'true' : undefined}
                >
                  {deleteSubmitting.value ? <span class="spinner" aria-hidden="true" /> : 'Да, удалить'}
                </button>
              </>
            ),
          }}
        </UiDialog>

        {/* ── Диалог выдачи прав администратора ── */}
        <UiDialog open={grantOpen.value} title="Выдать права администратора?" size="sm" onClose={closeGrant}>
          {{
            default: () => (
              <div class="ep-cancel-confirm">
                <p class="ep-cancel-confirm__text">
                  Назначить пользователя <strong>{grantTarget.value?.email}</strong> администратором?
                  Он получит доступ к модерации отзывов, управлению пользователями и аналитике.
                </p>
                {grantError.value && (
                  <div class="ecf__alert"><UiAlert variant="error" title="Ошибка">{grantError.value}</UiAlert></div>
                )}
              </div>
            ),
            footer: () => (
              <>
                <button type="button" class="btn btn--secondary" onClick={closeGrant} disabled={grantSubmitting.value}>Отмена</button>
                <button
                  type="button"
                  class="btn btn--primary"
                  onClick={submitGrant}
                  disabled={grantSubmitting.value}
                  aria-busy={grantSubmitting.value ? 'true' : undefined}
                >
                  {grantSubmitting.value ? <span class="spinner" aria-hidden="true" /> : 'Да, назначить'}
                </button>
              </>
            ),
          }}
        </UiDialog>
      </div>
    )
  },
})
