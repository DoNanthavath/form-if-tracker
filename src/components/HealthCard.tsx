import { useState } from 'react';
import { Copy, HeartPulse, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, SectionTitle } from './ui';
import { useApp } from '../app/context';
import { useSyncConfig } from '../hooks/useDeviceConfig';
import { pullHealth } from '../sync/sheets';
import { APPS_SCRIPT_VERSION } from '../sync/appsScript';
import { useToast } from './Toast';
import { SETUP_URL } from './SheetsCard';
import type { TKey } from '../i18n';

/** Apple Health (and Zepp via Apple Health) → iPhone Shortcut → user's Sheet → FORM. */
export function HealthCard() {
  const { t, fmtDate, fmtTime } = useApp();
  const cfg = useSyncConfig();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const connected = cfg.enabled && !!cfg.url;
  const outdated = (cfg.scriptVersion ?? 2) < APPS_SCRIPT_VERSION || cfg.healthError === 'script-outdated';
  const shortcutUrl = cfg.healthKey ? `${cfg.url}?action=health&key=${cfg.healthKey}` : '';

  const pull = async () => {
    setBusy(true);
    try {
      const r = await pullHealth();
      toast(t('healthPulled', { a: r.activities, w: r.weights }));
    } catch (e) {
      toast(t('syncError', { e: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const steps: TKey[] = ['hsStep1', 'hsStep2', 'hsStep3', 'hsStep4', 'hsStep5', 'hsStep6', 'hsStep7'];

  return (
    <Card>
      <SectionTitle action={cfg.healthLastPull && !outdated ? <Badge>✓</Badge> : undefined}>
        <span className="inline-flex items-center gap-2"><HeartPulse size={20} className="text-mint" />{t('healthTitle')}</span>
      </SectionTitle>
      <p className="text-[15px] leading-snug text-ink2">{t('healthIntro')}</p>

      {!connected ? (
        <p className="mt-3 text-[15px] text-ink3">{t('healthNeedSheets')}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {outdated && (
            <div className="rounded-[12px] bg-[var(--fill)] p-3 text-[15px] leading-snug">
              <div className="font-semibold text-warn">{t('healthUpdateScript')}</div>
              <div className="mt-1 text-ink2">{t('healthUpdateScriptBody')}</div>
              <div className="mt-2 break-all font-mono text-[12px] text-ink">{SETUP_URL.replace('https://', '')}</div>
            </div>
          )}

          <div>
            <div className="mb-1 text-[13px] text-ink2">{t('healthZepp')}</div>
            <p className="text-[15px] leading-snug">{t('healthZeppBody')}</p>
          </div>

          <div>
            <div className="mb-1 text-[13px] text-ink2">{t('healthShortcut')}</div>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-snug">
              {steps.map((k) => <li key={k}>{t(k)}</li>)}
            </ol>
          </div>

          {shortcutUrl ? (
            <>
              <div className="break-all rounded-[10px] bg-bg2 px-3 py-2 font-mono text-[12px] text-ink2">{shortcutUrl.replace(/key=([0-9a-f]{6})[0-9a-f]+/, 'key=$1…')}</div>
              <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(shortcutUrl).catch(() => {}); toast(t('copied')); }}>
                <Copy size={18} />{t('healthCopyUrl')}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={pull}>{t('healthPrepare')}</Button>
          )}

          <Button disabled={busy} onClick={pull}><RefreshCw size={18} className={busy ? 'animate-spin' : ''} />{t('healthPullNow')}</Button>
          <div className="text-[13px] text-ink3">
            {cfg.healthLastPull ? t('healthLast', { d: `${fmtDate(cfg.healthLastPull, { day: 'numeric', month: 'short' })} ${fmtTime(cfg.healthLastPull)}` }) : t('healthNever')}
            {cfg.healthError && cfg.healthError !== 'script-outdated' && <span className="text-danger"> · {cfg.healthError}</span>}
          </div>
          <p className="text-[13px] leading-snug text-ink3">{t('healthPrivacy')}</p>
        </div>
      )}
    </Card>
  );
}
