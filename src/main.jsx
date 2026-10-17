import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'
import './index.css'
import './i18n'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

// The Android app ships its files inside the APK; a service worker there would
// only serve a cached copy of the previous version after an update.
if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  registerSW({ immediate: true })
}

// Mobile browsers skip :active/tap-highlight rendering on pages with no
// touch listeners (treated as passively scrollable) -- this one-time no-op
// listener makes tap feedback on the footer icon links actually render.
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
