// @env browser
import { createApp } from 'vue'
import App from './App.vue'
import '@codex-proxy/ui/styles.css'
import './styles.css'

async function main() {
  let preview = false
  if (import.meta.env.DEV && !window.codexProxyPlugin) {
    const { installPreview } = await import('./preview')
    installPreview()
    preview = true
  }
  createApp(App, { preview }).mount('#app')
}
main()
