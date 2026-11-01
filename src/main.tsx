import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

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

