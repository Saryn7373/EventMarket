import { defineComponent, type PropType, computed } from 'vue'

export default defineComponent({
  name: 'UiButton',
  inheritAttrs: false,
  props: {
    variant: {
      type: String as PropType<'primary' | 'secondary' | 'danger' | 'ghost'>,
      default: 'primary',
    },
    size: {
      type: String as PropType<'sm' | 'md' | 'lg'>,
      default: 'md',
    },
    loading: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String as PropType<'button' | 'submit' | 'reset'>,
      default: 'button',
    },
    /**
     * Доступное название для кнопок без видимого текста (например, иконочных).
     * Если указан — рендерится в .sr-only внутри кнопки.
     */
    srLabel: {
      type: String,
      default: '',
    },
  },
  setup(props, { slots, attrs }) {
    const classes = computed(() => [
      'btn',
      `btn--${props.variant}`,
      `btn--${props.size}`,
      { 'btn--loading': props.loading },
    ])

    return () => (
      <button
        class={classes.value}
        disabled={props.disabled || props.loading}
        type={props.type}
        aria-busy={props.loading ? 'true' : undefined}
        {...attrs}
      >
        {props.loading ? (
          <>
            <span class="spinner" aria-hidden="true" />
            <span class="sr-only">Загрузка</span>
          </>
        ) : (
          <>
            {slots.default?.()}
            {props.srLabel && <span class="sr-only">{props.srLabel}</span>}
          </>
        )}
      </button>
    )
  },
})
