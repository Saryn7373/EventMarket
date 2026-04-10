import { defineComponent, type PropType, computed, ref } from 'vue'

export default defineComponent({
  name: 'UiInput',
  props: {
    modelValue: {
      type: [String, Number] as PropType<string | number>,
      default: '',
    },
    type: {
      type: String as PropType<'text' | 'email' | 'password' | 'number' | 'tel'>,
      default: 'text',
    },
    label: {
      type: String,
      required: true,
    },
    placeholder: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: '',
    },
    required: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    const isFocused = ref(false)

    const classes = computed(() => [
      'input',
      { 'input--error': props.error },
      { 'input--focused': isFocused.value },
      { 'input--disabled': props.disabled },
    ])

    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement
      emit('update:modelValue', target.value)
    }

    return () => (
      <div class="input-wrapper">
        <label class="input-label">
          {props.label}
          {props.required && <span class="input-required">*</span>}
        </label>

        <div class="input-container">
          {slots.prefix && <span class="input-prefix">{slots.prefix()}</span>}

          <input
            class={classes.value}
            type={props.type}
            value={props.modelValue}
            placeholder={props.placeholder}
            disabled={props.disabled}
            required={props.required}
            onInput={onInput}
            onFocus={() => (isFocused.value = true)}
            onBlur={() => (isFocused.value = false)}
          />

          {slots.suffix && <span class="input-suffix">{slots.suffix()}</span>}
        </div>

        {props.error && <p class="input-error">{props.error}</p>}
      </div>
    )
  },
})
