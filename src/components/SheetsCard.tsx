import { useState } from 'react';
import { Copy, ExternalLink, RefreshCw, Share, Sheet as SheetIcon, Unplug } from 'lucide-react';
import { Badge, Button, Card, SectionTitle, TextInput } from './ui';
import { useApp } from '../app/context';
import { useSyncConfig } from '../hooks/useDeviceConfig';
import { isAppsScriptUrl, syncNow, writeSync } from '../sync/sheets';
import { newToken, SETUP_PATH } from '../sync/appsScript';
import { useToast } from './Toast';
import { useConfirm } from './Confirm';
import { RestoreFromSheet } from './RestoreSheet';

export const SETUP_URL = `https://donanthavath.github.io/form-if-tracker/${SETUP_PATH}`;

export function SheetsCard() {
  const { t, fmtDate, fmtTime } = useApp();
  const cfg = useSyncConfig();
  const toast = useToast();
  const confirm = useConfirm();
  const [url, setUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (allowEmpty = false): Promise<void> => {
    setBusy(true);
    try {
      await syncNow({ allowEmpty });
      toast(t('syncDone'));
    } catch (e) {
      if ((e as Error).message === 'empty-local') {
        setBusy(false);
        const overwrite = await confirm({ title: t('emptyLocalTitle'), body: t('emptyLocalBody'), confirmLabel: t('overwriteSheet'), danger: true });
        if (overwrite) return run(true);
        return;
      }
      toast(t('syncError', { e: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    const u = url.trim();
    if (!isAppsScriptUrl(u)) return setErr(t('errUrl'));
    setErr(null);
    await writeSync({ url: u, enabled: true, lastError: null, token: cfg.token || newToken() });
    await run();
  };

  const shareLink = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'FORM – Google Sheets', url: SETUP_URL });
      else {
        await navigator.clipboard.writeText(SETUP_URL);
        toast(t('copied'));
      }
    } catch {
      /* user cancelled */
    }
  };

  const connected = cfg.enabled && !!cfg.url;
  return (
    <Card>
      <SectionTitle action={connected ? <Badge>{t('syncOn')}</Badge> : undefined}>
        <span className="inline-flex items-center gap-2"><SheetIcon size={18} className="text-mint" />{t('sheetsTitle')}</span>
      </SectionTitle>
      <p className="text-[13px] leading-relaxed text-ink2">{t('sheetsIntro')}</p>

      {connected ? (
        <div className="mt-4 flex flex-col gap-2.5">
          <div className="rounded-2xl bg-bg2 p-3 text-[12px] text-ink2">
            {cfg.lastSyncAt ? t('lastSynced', { d: `${fmtDate(cfg.lastSyncAt, { day: 'numeric', month: 'short' })} ${fmtTime(cfg.lastSyncAt)}` }) : t('notSyncedYet')}
            {cfg.lastError && <div className="mt-1 text-danger">{cfg.lastError === 'empty-local' ? t('emptyLocalShort') : t('syncError', { e: cfg.lastError })}</div>}
            {cfg.lastError === 'unauthorized' && <div className="mt-1 text-ink3">{t('sheetsResetHint')}</div>}
          </div>
          {cfg.sheetUrl && (
            <a href={cfg.sheetUrl} target="_blank" rel="noreferrer" className="press inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-mint px-5 text-[15px] font-semibold text-mintink">
              <ExternalLink size={18} />{t('sheetsOpen')}
            </a>
          )}
          <Button variant={cfg.sheetUrl ? 'secondary' : 'primary'} disabled={busy} onClick={() => run()}><RefreshCw size={18} className={busy ? 'animate-spin' : ''} />{t('syncNow')}</Button>
          <RestoreFromSheet />
          <Button variant="ghost" onClick={async () => (await confirm({ title: t('disconnectConfirm'), confirmLabel: t('disconnect'), danger: true })) && writeSync({ enabled: false, url: '', lastError: null })}>
            <Unplug size={18} />{t('disconnect')}
          </Button>
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-4 text-[13px] leading-relaxed text-ink2">
          <li className="flex gap-3">
            <Step n={1} />
            <div className="min-w-0 flex-1">
              {t('sheetsPhone1')}
              <div className="mt-2 break-all rounded-xl bg-bg2 px-3 py-2 font-mono text-[12px] text-ink">{SETUP_URL.replace('https://', '')}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="!px-2" onClick={shareLink}><Share size={16} />{t('shareLink')}</Button>
                <Button variant="secondary" className="!px-2" onClick={async () => { await navigator.clipboard.writeText(SETUP_URL).catch(() => {}); toast(t('copied')); }}><Copy size={16} />{t('copyLink')}</Button>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <div className="min-w-0 flex-1">
              {t('sheetsPhone2')}
              <div className="mt-2 flex flex-col gap-2">
                <TextInput label={t('webAppUrl')} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" error={err} autoComplete="off" inputMode="url" />
                <Button disabled={busy || !url.trim()} onClick={connect}>{t('connect')}</Button>
              </div>
            </div>
          </li>
        </ol>
      )}
      {!connected && <div className="mt-4"><RestoreFromSheet /></div>}
      <p className="mt-4 text-[11px] leading-relaxed text-ink3">{t('sheetsPrivacy')}</p>
    </Card>
  );
}

function Step({ n }: { n: number }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mintsoft text-[12px] font-bold text-mint">{n}</span>;
}
