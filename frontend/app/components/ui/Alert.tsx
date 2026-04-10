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

    return () => (
      <div class={classes.value}>
        <span class="alert-icon">{icon.value}</span>
        <div class="alert-content">
          {props.title && <p class="alert-title">{props.title}</p>}
          {slots.default?.()}
        </div>
      </div>
    )
  },
})
