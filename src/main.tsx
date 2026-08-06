import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Enregistrement du service worker pour les notifications push critiques.
// Ne demande aucune permission ici — juste l'enregistrement passif ;
// l'abonnement effectif se fait via une action utilisateur explicite
// (voir usePushNotifications).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] registration failed', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
