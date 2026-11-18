import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Flame, Home, Settings as Gear, Utensils } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useApp } from './app/context';
import { HomePage } from './pages/Home';
import { FastingPage } from './pages/Fasting';
import { FoodPage } from './pages/Food';
import { SettingsPage } from './pages/Settings';
import { Button, Sheet, cx } from './components/ui';
import type { TKey } from './i18n';

const ProgressPage = lazy(() => import('./pages/Progress').then((m) => ({ default: m.ProgressPage })));

export type Tab = 'home' | 'fasting' | 'food' | 'progress' | 'settings';
const TABS: { id: Tab; icon: ReactNode; label: TKey }[] = [
  { id: 'home', icon: <Home size={23} />, label: 'navHome' },
  { id: 'fasting', icon: <Flame size={23} />, label: 'navFasting' },
  { id: 'food', icon: <Utensils size={23} />, label: 'navFood' },
  { id: 'progress', icon: <BarChart3 size={23} />, label: 'navProgress' },
  { id: 'settings', icon: <Gear size={23} />, label: 'navSettings' },
];

function readTab(): Tab {
  const h = location.hash.replace('#/', '') as Tab;
  return TABS.some((x) => x.id === h) ? h : 'home';
}

export default function App() {
  const { t, settings, update } = useApp();
  const [tab, setTab] = useState<Tab>(readTab);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next: Tab) => {
    if (next !== tab) history.pushState(null, '', `#/${next}`);
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-xl focus:bg-mint focus:px-3 focus:py-2 focus:text-mintink">
        Skip to content
      </a>
      <main id="main" className="pt-safe pb-nav px-safe mx-auto w-full max-w-2xl" key={tab}>
        <div className="anim-in">
          {tab === 'home' && <HomePage go={go} />}
          {tab === 'fasting' && <FastingPage />}
          {tab === 'food' && <FoodPage />}
          {tab === 'progress' && (
            <Suspense fallback={<div className="py-20 text-center text-ink3" role="status">{t('loading')}</div>}>
              <ProgressPage />
            </Suspense>
          )}
          {tab === 'settings' && <SettingsPage />}
        </div>
      </main>

      <nav aria-label="Main" className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-2xl justify-around px-[max(env(safe-area-inset-left),8px)]">
          {TABS.map((x) => {
            const active = x.id === tab;
            return (
              <li key={x.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => go(x.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cx('press flex min-h-[58px] w-full flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] font-semibold transition-colors', active ? 'text-mint' : 'text-ink3 hover:text-ink2')}
                >
                  {x.icon}
                  <span className="max-w-full truncate px-0.5">{t(x.label)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <UpdatePrompt />

      <Sheet open={!settings.onboarded} onClose={() => update({ onboarded: true })} title={t('welcomeTitle')} footer={<Button className="w-full" onClick={() => update({ onboarded: true })}>{t('getStarted')}</Button>}>
        <div className="flex flex-col gap-3 pb-2 text-[14px] leading-relaxed text-ink2">
          <p>{t('welcomeBody')}</p>
          <p className="text-[13px]">{t('privacyNote')}</p>
          <p className="text-[12px] text-ink3">{t('medicalDisclaimer')}</p>
        </div>
      </Sheet>
    </>
  );
}

function UpdatePrompt() {
  const { t } = useApp();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for updates hourly while the app stays open.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="anim-in glass fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 shadow-xl" role="status">
      <span className="text-[14px]">{t('updateReady')}</span>
      <div className="flex gap-2">
        <Button variant="ghost" className="!min-h-[38px] !px-3" onClick={() => setNeedRefresh(false)}>{t('close')}</Button>
        <Button className="!min-h-[38px] !px-4" onClick={() => updateServiceWorker(true)}>{t('reload')}</Button>
      </div>
    </div>
  );
}
