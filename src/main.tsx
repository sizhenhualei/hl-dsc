import './polyfills.js'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.js'
import { setupTheme } from './app/theme.js'
import { ErrorBoundary } from './components/base/ErrorBoundary.js'
import { ensureKatex } from './services/markdown/katex.js'
import './app/theme.css'
import './app/global.css'

if (new URLSearchParams(window.location.search).has('preview')) {
  document.documentElement.classList.add('preview')
}

ensureKatex()
setupTheme()

createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
