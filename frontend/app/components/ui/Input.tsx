import { defineComponent, type PropType, computed, ref } from 'vue'

let uidCounter = 0
const nextUid = () => `ui-input-${++uidCounter}`

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
    hint: {
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
    id: {
      type: String,
      default: '',
    },
    autocomplete: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    const isFocused = ref(false)
    const inputId = computed(() => props.id || nextUid())
    const errorId = computed(() => `${inputId.value}-error`)
    const hintId = computed(() => `${inputId.value}-hint`)

    const describedBy = computed(() => {
      const ids: string[] = []
      if (props.hint) ids.push(hintId.value)
      if (props.error) ids.push(errorId.value)
      return ids.length ? ids.join(' ') : undefined
    })

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
        <label class="input-label" for={inputId.value}>
          {props.label}
          {props.required && (
            <>
              <span class="input-required" aria-hidden="true">*</span>
              <span class="sr-only"> (обязательно)</span>
            </>
          )}
        </label>

        <div class="input-container">
          {slots.prefix && (
            <span class="input-prefix" aria-hidden="true">
              {slots.prefix()}
            </span>
          )}

          <input
            id={inputId.value}
            class={classes.value}
            type={props.type}
            value={props.modelValue}
            placeholder={props.placeholder}
            disabled={props.disabled}
            required={props.required}
            autocomplete={props.autocomplete || undefined}
            aria-invalid={props.error ? 'true' : undefined}
            aria-describedby={describedBy.value}
            onInput={onInput}
            onFocus={() => (isFocused.value = true)}
            onBlur={() => (isFocused.value = false)}
          />

          {slots.suffix && (
            <span class="input-suffix" aria-hidden="true">
              {slots.suffix()}
            </span>
          )}
        </div>

        {props.hint && !props.error && (
          <p class="input-hint" id={hintId.value}>
            {props.hint}
          </p>
        )}

        {props.error && (
          <p class="input-error" id={errorId.value} role="alert">
            {props.error}
          </p>
        )}
      </div>
    )
  },
})
