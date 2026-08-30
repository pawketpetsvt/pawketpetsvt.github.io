import { reactive } from 'vue'

export const toastState = reactive({
  current: null,
  visible: false
})

const queue = []
let isShowing = false

const ICONS = { success: '✓', error: '✗', warning: '⚠', info: 'ⓘ' }

function showNext() {
  if (queue.length === 0) {
    isShowing = false
    toastState.current = null
    toastState.visible = false
    return
  }
  isShowing = true
  const toast = queue.shift()
  toastState.current = { message: toast.message, type: toast.type, icon: ICONS[toast.type] || ICONS.info }
  toastState.visible = false

  setTimeout(() => { toastState.visible = true }, 10)

  setTimeout(() => {
    toastState.visible = false
    setTimeout(showNext, 300)
  }, 3000)
}

class ToastService {
  show(message, type = 'info') {
    queue.push({ message, type })
    if (!isShowing) showNext()
  }

  success(message) { this.show(message, 'success') }
  error(message) { this.show(message, 'error') }
  warning(message) { this.show(message, 'warning') }
  info(message) { this.show(message, 'info') }
}

export const toastService = new ToastService()
