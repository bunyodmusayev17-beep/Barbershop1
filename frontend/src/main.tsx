import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import {installPressFx} from './lib/pressFx'
import {initTelegram} from './lib/telegram'

installPressFx()

// Telegram Mini App bo'lsa — avval Telegram skripti (oddiy brauzerda darhol)
initTelegram().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
