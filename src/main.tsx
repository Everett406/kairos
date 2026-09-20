import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './design/tokens.css'
import './design/theme-dark.css'
import './design/theme-light.css'
import './design/base.css'

// 浏览器预览（无 Tauri）：html 给一层实底，避免半透明窗体透出白底
if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
  document.documentElement.classList.add('browser-preview')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
