import { Copy, ExternalLink } from 'lucide-react';
import { useApp } from '../app/context';
import { Button, Card } from '../components/ui';
import { APPS_SCRIPT_SOURCE } from '../sync/appsScript';
import { useToast } from '../components/Toast';

/** Stand-alone page meant to be opened on a computer: #/sheets */
export function SheetsSetupPage() {
  const { t } = useApp();
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_SOURCE);
      toast(t('copied'));
    } catch {
      toast(t('errorGeneric'));
    }
  };
  const steps = [
    <>
      <p>{t('setupA')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={copy}><Copy size={18} />{t('copyScript')}</Button>
        <a href="https://script.new" target="_blank" rel="noreferrer" className="press inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-line bg-card2 px-5 text-[15px] font-semibold">
          <ExternalLink size={18} />{t('openScriptNew')}
        </a>
      </div>
    </>,
    <p>{t('setupB')}</p>,
    <p>{t('setupC')}</p>,
  ];
  return (
    <main className="px-safe mx-auto w-full max-w-2xl py-10">
      <div className="text-[13px] font-semibold tracking-[0.3em] text-mint">FORM</div>
      <h1 className="mt-1 text-[30px] font-bold tracking-tight">{t('setupTitle')}</h1>
      <p className="mt-2 text-[15px] text-ink2">{t('setupSub')}</p>
      <ol className="mt-6 flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={i}>
            <Card className="flex gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint text-[16px] font-bold text-mintink">{i + 1}</span>
              <div className="flex-1 text-[15px] leading-relaxed">{s}</div>
            </Card>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-[13px] leading-relaxed text-ink3">{t('setupWhy')}</p>
      <details className="mt-5 text-[13px] text-ink3">
        <summary className="cursor-pointer">Apps Script</summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded-2xl border border-line bg-bg2 p-4 text-[12px] leading-relaxed text-ink2">{APPS_SCRIPT_SOURCE}</pre>
      </details>
      <a href="#/home" className="mt-6 inline-block text-[14px] font-semibold text-mint">← {t('backToApp')}</a>
    </main>
  );
}
