import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SyncProvider } from './contexts/SyncContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SyncProvider>
      <App />
    </SyncProvider>
  </StrictMode>,
);
