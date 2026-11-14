import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { gestisciRitornoAccesso } from './google/calendar'

// Ritorno dall'accesso Google: va gestito prima che parta il router
const msgGoogle = gestisciRitornoAccesso()
if (msgGoogle) sessionStorage.setItem('hf-msg', msgGoogle)

// Chiede al browser di non cancellare i dati locali quando manca spazio
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
