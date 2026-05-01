import { defineComponent, type PropType, computed, ref } from 'vue'

export interface SelectOption {
  value: string
  label: string
  icon?: string
  description?: string
}

let uidCounter = 0
const nextUid = () => `ui-select-${++uidCounter}`

export default defineComponent({
  name: 'UiSelect',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    label: {
      type: String,
      required: true,
    },
    options: {
      type: Array as PropType<SelectOption[]>,
      required: true,
    },
    placeholder: {
      type: String,
      default: 'Выберите...',
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
    id: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isFocused = ref(false)
    const selectId = computed(() => props.id || nextUid())
    const errorId = computed(() => `${selectId.value}-error`)
    const descId = computed(() => `${selectId.value}-desc`)

    const classes = computed(() => [
      'select',
      { 'select--error': props.error },
      { 'select--focused': isFocused.value },
      { 'select--disabled': props.disabled },
    ])

    const selectedOption = computed(() =>
      props.options.find((opt) => opt.value === props.modelValue)
    )

    const describedBy = computed(() => {
      const ids: string[] = []
      if (selectedOption.value?.description) ids.push(descId.value)
      if (props.error) ids.push(errorId.value)
      return ids.length ? ids.join(' ') : undefined
    })

    const onChange = (event: Event) => {
      const target = event.target as HTMLSelectElement
      emit('update:modelValue', target.value)
    }

    return () => (
      <div class="select-wrapper">
        <label class="select-label" for={selectId.value}>
          {props.label}
          {props.required && (
            <>
              <span class="select-required" aria-hidden="true">*</span>
              <span class="sr-only"> (обязательно)</span>
            </>
          )}
        </label>

        <select
          id={selectId.value}
          class={classes.value}
          value={props.modelValue}
          disabled={props.disabled}
          required={props.required}
          aria-invalid={props.error ? 'true' : undefined}
          aria-describedby={describedBy.value}
          onChange={onChange}
          onFocus={() => (isFocused.value = true)}
          onBlur={() => (isFocused.value = false)}
        >
          <option value="" disabled>
            {props.placeholder}
          </option>
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.icon && `${option.icon} `}
              {option.label}
            </option>
          ))}
        </select>

        {props.error && (
          <p class="select-error" id={errorId.value} role="alert">
            {props.error}
          </p>
        )}

        {selectedOption.value?.description && (
          <p class="select-description" id={descId.value}>
            {selectedOption.value.description}
          </p>
        )}
      </div>
    )
  },
})
