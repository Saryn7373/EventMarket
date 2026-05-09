import { defineComponent, ref, watch, type PropType } from 'vue'

export default defineComponent({
  name: 'UiDialog',
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, required: true },
    size: {
      type: String as PropType<'sm' | 'md' | 'lg'>,
      default: 'md',
    },
  },
  emits: ['close'],
  setup(props, { emit, slots }) {
    const dialogEl = ref<HTMLDialogElement | null>(null)

    watch(
      () => props.open,
      (isOpen) => {
        if (!dialogEl.value) return
        if (isOpen) {
          dialogEl.value.showModal()
        } else {
          dialogEl.value.close()
        }
      },
      { flush: 'post' },
    )

    const onClose = () => emit('close')

    // Клик по backdrop (вне .ui-dialog__inner) закрывает диалог
    const onBackdropClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement) === dialogEl.value) {
        emit('close')
      }
    }

    return () => (
      <dialog
        ref={dialogEl}
        class={['ui-dialog', `ui-dialog--${props.size}`]}
        aria-labelledby="ui-dialog-title"
        aria-modal="true"
        onClose={onClose}
        onClick={onBackdropClick}
      >
        <div class="ui-dialog__inner">
          <div class="ui-dialog__header">
            <h2 id="ui-dialog-title" class="ui-dialog__title">
              {props.title}
            </h2>
            <button
              type="button"
              class="ui-dialog__close-btn"
              aria-label="Закрыть диалог"
              onClick={() => emit('close')}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <div class="ui-dialog__body">
            {slots.default?.()}
          </div>

          {slots.footer && (
            <div class="ui-dialog__footer">
              {slots.footer()}
            </div>
          )}
        </div>
      </dialog>
    )
  },
})
