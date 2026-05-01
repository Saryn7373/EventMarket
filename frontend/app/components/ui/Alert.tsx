import { defineComponent, type PropType, computed } from 'vue'

export default defineComponent({
  name: 'UiAlert',
  props: {
    variant: {
      type: String as PropType<'info' | 'success' | 'warning' | 'error'>,
      default: 'info',
    },
    title: {
      type: String,
      default: '',
    },
  },
  setup(props, { slots }) {
    const classes = computed(() => [
      'alert',
      `alert--${props.variant}`,
    ])

    const icon = computed(() => {
      const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
      }
      return icons[props.variant]
    })

    const variantLabel = computed(() => {
      const labels = {
        info: 'Информация',
        success: 'Успех',
        warning: 'Предупреждение',
        error: 'Ошибка',
      }
      return labels[props.variant]
    })

    // Ошибки и предупреждения должны прерывать чтение скринридера,
    // успехи и инфо — мягко объявляться через polite live region.
    const role = computed(() =>
      props.variant === 'error' || props.variant === 'warning' ? 'alert' : 'status'
    )

    return () => (
      <div class={classes.value} role={role.value}>
        <span class="alert-icon" aria-hidden="true">
          {icon.value}
        </span>
        <span class="sr-only">{variantLabel.value}: </span>
        <div class="alert-content">
          {props.title && <p class="alert-title">{props.title}</p>}
          {slots.default?.()}
        </div>
      </div>
    )
  },
})
