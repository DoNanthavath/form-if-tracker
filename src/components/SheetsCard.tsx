import { useState } from 'react';
import { Copy, ExternalLink, RefreshCw, Sheet as SheetIcon, Unplug } from 'lucide-react';
import { Badge, Button, Card, SectionTitle, TextInput } from './ui';
import { useApp } from '../app/context';
import { useSyncConfig } from '../hooks/useDeviceConfig';
import { isAppsScriptUrl, syncNow, writeSync } from '../sync/sheets';
import { appsScriptSource, newToken } from '../sync/appsScript';
import { useToast } from './Toast';
import { useConfirm } from './Confirm';

export function SheetsCard() {
  const { t, fmtDate, fmtTime } = useApp();
  const cfg = useSyncConfig();
  const toast = useToast();
  const confirm = useConfirm();
  const [url, setUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ensureToken = async () => {
    if (cfg.token) return cfg.token;
    const token = newToken();
    await writeSync({ token });
    return token;
  };

  const copyScript = async () => {
    const token = await ensureToken();
    try {
      await navigator.clipboard.writeText(appsScriptSource(token));
      toast(t('copied'));
    } catch {
      setErr(t('errorGeneric'));
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast(t('syncDone'));
    } catch (e) {
      toast(t('syncError', { e: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    const u = url.trim();
    if (!isAppsScriptUrl(u)) return setErr(t('errUrl'));
    setErr(null);
    await ensureToken();
    await writeSync({ url: u, enabled: true, lastError: null });
    await run(syncNow);
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
            {cfg.lastError && <div className="mt-1 text-danger">{t('syncError', { e: cfg.lastError })}</div>}
          </div>
          <Button disabled={busy} onClick={() => run(syncNow)}><RefreshCw size={18} className={busy ? 'animate-spin' : ''} />{t('syncNow')}</Button>
          <Button variant="secondary" onClick={copyScript}><Copy size={18} />{t('copyScript')}</Button>
          <Button variant="ghost" onClick={async () => (await confirm({ title: t('disconnectConfirm'), confirmLabel: t('disconnect'), danger: true })) && writeSync({ enabled: false, url: '', lastError: null })}>
            <Unplug size={18} />{t('disconnect')}
          </Button>
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-3 text-[13px] leading-relaxed text-ink2">
          <li className="flex gap-3"><Step n={1} /><div>{t('sheetsStep1')} <a className="inline-flex items-center gap-1 font-semibold text-mint" href="https://sheets.new" target="_blank" rel="noreferrer">sheets.new <ExternalLink size={13} /></a></div></li>
          <li className="flex gap-3"><Step n={2} /><div className="flex-1">{t('sheetsStep2')}<Button variant="secondary" className="mt-2 w-full" onClick={copyScript}><Copy size={18} />{t('copyScript')}</Button></div></li>
          <li className="flex gap-3"><Step n={3} /><div>{t('sheetsStep3')}</div></li>
          <li className="flex gap-3"><Step n={4} /><div className="flex-1">{t('sheetsStep4')}
            <div className="mt-2 flex flex-col gap-2">
              <TextInput label={t('webAppUrl')} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" error={err} autoComplete="off" inputMode="url" />
              <Button disabled={busy || !url.trim()} onClick={connect}>{t('connect')}</Button>
            </div>
          </div></li>
        </ol>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-ink3">{t('sheetsPrivacy')}</p>
    </Card>
  );
}

function Step({ n }: { n: number }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mintsoft text-[12px] font-bold text-mint">{n}</span>;
}
