import { reactive } from 'vue'

export const toastState = reactive({ message: '', visible: false })

let hideTimer = null

export function showToast(message) {
  toastState.message = message
  toastState.visible = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { toastState.visible = false }, 3000)
}
