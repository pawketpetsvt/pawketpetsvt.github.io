import { reactive } from 'vue'

export const modalState = reactive({
  open: false,
  title: '',
  message: '',
  icon: '🎉',
  buttonText: 'Awesome!'
})

let resolveCurrent = null

const BUTTON_TEXTS = ['Awesome!', 'Got it!', 'Sweet!', 'Nice!', 'Thanks!', 'Cool!', 'Perfect!', 'Yay!']

class ModalService {
  alert(title, message, icon = '🎉') {
    return new Promise((resolve) => {
      modalState.title = title
      modalState.message = message
      modalState.icon = icon
      modalState.buttonText = BUTTON_TEXTS[Math.floor(Math.random() * BUTTON_TEXTS.length)]
      modalState.open = true
      resolveCurrent = resolve
    })
  }

  success(title, message) { return this.alert(title, message, '✅') }
  error(title, message) { return this.alert(title, message, '❌') }
  warning(title, message) { return this.alert(title, message, '⚠️') }

  close() {
    modalState.open = false
    if (resolveCurrent) {
      resolveCurrent()
      resolveCurrent = null
    }
  }
}

export const modalService = new ModalService()
