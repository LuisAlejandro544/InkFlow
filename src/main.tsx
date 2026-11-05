import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { detectIsTauri } from './engine/environmentDetector';
import './index.css';

// Registrar Service Worker para funcionamiento 100% Offline de la PWA (en Tauri APK los archivos ya son locales nativos)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !detectIsTauri()) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nueva versión disponible.');
      window.dispatchEvent(new CustomEvent('pwa-need-refresh'));
    },
    onOfflineReady() {
      console.log('[PWA] Aplicación cacheada y lista para funcionar 100% offline sin internet.');
      window.dispatchEvent(new CustomEvent('pwa-offline-ready'));
    },
    onRegisterError(error) {
      console.warn('[PWA Error de registro]', error);
    },
  });
}

window.addEventListener('error', (event) => {
  console.error('[App Runtime Error]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[App Unhandled Rejection]', event.reason);
});

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} else {
  console.error('Fatal: #root element not found in DOM.');
}

