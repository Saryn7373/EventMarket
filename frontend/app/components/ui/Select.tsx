import { defineComponent, type PropType, computed, ref } from 'vue'

export interface SelectOption {
  value: string
  label: string
  icon?: string
  description?: string
}

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
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isFocused = ref(false)

    const classes = computed(() => [
      'select',
      { 'select--error': props.error },
      { 'select--focused': isFocused.value },
      { 'select--disabled': props.disabled },
    ])

    const selectedOption = computed(() =>
      props.options.find((opt) => opt.value === props.modelValue)
    )

    const onChange = (event: Event) => {
      const target = event.target as HTMLSelectElement
      emit('update:modelValue', target.value)
    }

    return () => (
      <div class="select-wrapper">
        <label class="select-label">
          {props.label}
          {props.required && <span class="select-required">*</span>}
        </label>

        <select
          class={classes.value}
          value={props.modelValue}
          disabled={props.disabled}
          required={props.required}
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

        {props.error && <p class="select-error">{props.error}</p>}

        {selectedOption.value?.description && (
          <p class="select-description">
            {selectedOption.value.description}
          </p>
        )}
      </div>
    )
  },
})
