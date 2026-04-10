import { defineComponent, type PropType, computed } from 'vue'

export default defineComponent({
  name: 'UiButton',
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
        {...attrs}
      >
        {props.loading ? <span class="spinner" /> : slots.default?.()}
      </button>
    )
  },
})
