import { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button, Sheet } from './ui';
import { useApp } from '../app/context';
import { backupFromSheet, readSheetFile } from '../sync/restore';
import { backupCounts, importBackup, type Backup } from '../db/backup';
import { db } from '../db/db';
import { useToast } from './Toast';

/** Restore records from an .xlsx downloaded from the FORM Google Sheet. */
export function RestoreFromSheet({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const { t, tz } = useApp();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const res = backupFromSheet(await readSheetFile(file), tz);
      if (!res.ok) setErr(t('restoreErr', { e: res.error }));
      else setPending(res.backup);
    } catch (e) {
      setErr(t('restoreErr', { e: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!pending) return;
    await importBackup(db, pending, 'merge');
    toast(t('importDone'));
    setPending(null);
    setOpen(false);
  }

  return (
    <>
      <Button variant={variant} onClick={() => { setOpen(true); setPending(null); setErr(null); }}>
        <FileSpreadsheet size={18} />{t('restoreSheet')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('restoreSheet')} footer={pending ? <Button className="w-full" onClick={restore}>{t('restoreNow')}</Button> : undefined}>
        <div className="flex flex-col gap-4 py-1 text-[14px] leading-relaxed text-ink2">
          {!pending && (
            <>
              <ol className="flex list-decimal flex-col gap-2 pl-5">
                <li>{t('restoreStep1')}</li>
                <li>{t('restoreStep2')}</li>
                <li>{t('restoreStep3')}</li>
              </ol>
              <Button disabled={busy} onClick={() => ref.current?.click()}><FileSpreadsheet size={18} />{t('restorePick')}</Button>
            </>
          )}
          {pending && <p className="rounded-[12px] bg-mintsoft p-3 text-ink">{t('importPreview', backupCounts(pending))}</p>}
          {pending && <p className="text-[12px] text-ink3">{t('restoreMergeNote')}</p>}
          {err && <p role="alert" className="text-danger">{err}</p>}
          <input ref={ref} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </Sheet>
    </>
  );
}
