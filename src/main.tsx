import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AppProvider } from './app/context';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Confirm';
import { db } from './db/db';
import { initDatabase } from './db/backup';
import { installAutoSync } from './sync/sheets';

const root = createRoot(document.getElementById('root')!);

function Fatal({ error }: { error: unknown }) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#eee' }}>
      <h1>FORM</h1>
      <p>ไม่สามารถเปิดฐานข้อมูลในเครื่องได้ / Could not open local database.</p>
      <p style={{ opacity: 0.7, fontSize: 13 }}>{String((error as Error)?.message ?? error)}</p>
      <p style={{ opacity: 0.7, fontSize: 13 }}>Private Browsing may block storage. Try a normal Safari tab.</p>
    </div>
  );
}

initDatabase(db)
  .then(() => {
    installAutoSync();
    root.render(
      <StrictMode>
        <AppProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </AppProvider>
      </StrictMode>,
    );
  })
  .catch((e) => root.render(<Fatal error={e} />));
