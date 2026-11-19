import { useEffect, useRef, useState } from 'react';
import { Download, HardDrive, Shield, Trash2, Upload } from 'lucide-react';
import { useApp } from '../app/context';
import { Button, Card, Field, SectionTitle, Segmented, Select, Sheet, TextInput } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { PROTOCOLS, PROTOCOL_IDS, fastingStartTime } from '../lib/fasting';
import { bmr, suggestedBudget, tdee } from '../lib/nutrition';
import { latest } from '../lib/weight';
import { useWeights } from '../hooks/data';
import { db } from '../db/db';
import { backupCounts, backupFileName, exportBackup, importBackup, parseBackup, wipeAll, type Backup } from '../db/backup';
import { isValidTimeZone } from '../lib/time';
import type { Accent, ActivityLevel, BmrFormula, Settings, Sex } from '../lib/types';
import { SheetsCard } from '../components/SheetsCard';
import { AiCard } from '../components/AiCard';
import { HealthCard } from '../components/HealthCard';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Numeric setting that validates and saves on blur/Enter. */
function NumberSetting({ label, field, min, max, step = 1, nullable, hint }: { label: string; field: keyof Settings; min: number; max: number; step?: number; nullable?: boolean; hint?: string }) {
  const { settings, update, t } = useApp();
  const current = settings[field] as number | null;
  const [v, setV] = useState(current == null ? '' : String(current));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setV(current == null ? '' : String(current)), [current]);
  const commit = async () => {
    if (v.trim() === '' && nullable) {
      setErr(null);
      if (current !== null) await update({ [field]: null } as Partial<Settings>);
      return;
    }
    const n = Number(v.replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) return setErr(t('errRange', { a: min, b: max }));
    setErr(null);
    const rounded = Math.round(n / step) * step;
    if (rounded !== current) await update({ [field]: Math.round(rounded * 100) / 100 } as Partial<Settings>);
  };
  return <TextInput label={label} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} error={err} hint={hint} />;
}

export function SettingsPage() {
  const { t, settings, update, fmtDate, fmtTime } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const weights = useWeights() ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [goalsText, setGoalsText] = useState(settings.goalWeightsKg.join(', '));
  const [goalsErr, setGoalsErr] = useState<string | null>(null);
  const [tzText, setTzText] = useState(settings.timeZone);

  useEffect(() => setGoalsText(settings.goalWeightsKg.join(', ')), [settings.goalWeightsKg]);
  useEffect(() => setTzText(settings.timeZone), [settings.timeZone]);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const weightNow = latest(weights)?.kg ?? settings.startWeightKg;
  const bmrVal = bmr({ formula: settings.bmrFormula, sex: settings.sex, age: settings.age, heightCm: settings.heightCm, weightKg: weightNow, bodyFatPct: settings.bodyFatPct });
  const tdeeVal = bmrVal ? tdee(bmrVal, settings.activityLevel) : null;
  const sugg = tdeeVal ? suggestedBudget(tdeeVal, settings.weeklyLossTargetKg) : null;
  const minSafe = settings.sex === 'female' ? 1200 : 1500;

  async function doExport() {
    const b = await exportBackup(db);
    download(backupFileName(Date.now(), settings.timeZone), JSON.stringify(b, null, 2));
    await update({ lastExportAt: Date.now() });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast(t('importFailed', { e: 'file too large' }));
    const res = parseBackup(await file.text());
    if (!res.ok) return toast(t('importFailed', { e: res.error }));
    setPending(res.backup);
  }

  async function doImport(mode: 'merge' | 'replace') {
    if (!pending) return;
    try {
      if (mode === 'replace') {
        const ok = await confirm({ title: t('importReplace'), body: t('importReplaceWarn'), danger: true, confirmLabel: t('importReplace') });
        if (!ok) return;
        const current = await exportBackup(db);
        download(`form-before-import-${Date.now()}.json`, JSON.stringify(current));
      }
      await importBackup(db, pending, mode);
      toast(t('importDone'));
      setPending(null);
    } catch (e) {
      toast(t('importFailed', { e: (e as Error).message }));
    }
  }

  const tzOptions = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('settings')} />

      <Card>
        <div className="flex flex-col gap-4">
          <Field label={t('language')}>{() => <Segmented label={t('language')} value={settings.lang} onChange={(v) => update({ lang: v })} options={[{ value: 'th', label: 'ไทย' }, { value: 'en', label: 'English' }]} />}</Field>
          <Field label={t('theme')}>{() => <Segmented label={t('theme')} value={settings.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'dark', label: t('themeDark') }, { value: 'light', label: t('themeLight') }, { value: 'system', label: t('themeSystem') }]} />}</Field>
          <Field label={t('accentColor')}>
            {() => (
              <div role="radiogroup" aria-label={t('accentColor')} className="grid grid-cols-3 gap-2">
                {([['burgundy', '#a51d3f'], ['navy', '#007aff'], ['mint', '#34c759']] as [Accent, string][]).map(([id, c]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={settings.accent === id}
                    onClick={() => update({ accent: id })}
                    className={`press flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-[12px] text-[12px] font-semibold ${settings.accent === id ? 'bg-mintsoft text-ink ring-2 ring-mint' : 'bg-bg2 text-ink2'}`}
                  >
                    <span className="h-6 w-6 rounded-full" style={{ background: c }} />
                    {t(`accent_${id}`)}
                  </button>
                ))}
              </div>
            )}
          </Field>
          {tzOptions ? (
            <Select label={t('timeZone')} value={settings.timeZone} onChange={(v) => update({ timeZone: v })} options={[...new Set([settings.timeZone, 'Asia/Vientiane', 'Asia/Bangkok', ...tzOptions])].map((z) => ({ value: z, label: z }))} hint={`${fmtDate(Date.now(), { weekday: 'short', day: 'numeric', month: 'short' })} ${fmtTime(Date.now())}`} />
          ) : (
            <TextInput label={t('timeZone')} value={tzText} onChange={(e) => setTzText(e.target.value)} onBlur={() => (isValidTimeZone(tzText) ? update({ timeZone: tzText }) : setTzText(settings.timeZone))} />
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('fastingSchedule')}</SectionTitle>
        <div className="flex flex-col gap-4">
          <Field label={t('protocol')}>{() => <Segmented label={t('protocol')} value={settings.protocol} onChange={(v) => update({ protocol: v })} options={PROTOCOL_IDS.map((p) => ({ value: p, label: p }))} className="[&_button]:text-[12px]" />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label={t('eatingStarts')} type="time" value={settings.eatingStart} onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && update({ eatingStart: e.target.value })} />
            <TextInput label={t('eatingEnds')} type="time" value={fastingStartTime(settings)} readOnly aria-readonly="true" hint={`${PROTOCOLS[settings.protocol].eat} ${t('h')}`} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('nutritionGoals')}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <NumberSetting label={t('kcalBudget')} field="kcalBudget" min={800} max={6000} hint={settings.kcalBudget < minSafe ? t('belowMinWarn') : undefined} />
          <NumberSetting label={t('proteinGoal')} field="proteinG" min={0} max={400} />
          <NumberSetting label={`${t('carbsGoal')} (${t('optional')})`} field="carbsG" min={0} max={800} nullable />
          <NumberSetting label={`${t('fatGoal')} (${t('optional')})`} field="fatG" min={0} max={400} nullable />
          <NumberSetting label={t('waterGoal')} field="waterTargetMl" min={500} max={6000} step={50} />
          <NumberSetting label={t('weeklyLoss')} field="weeklyLossTargetKg" min={0} max={1} step={0.05} />
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('energyCalc')}</SectionTitle>
        <div className="flex flex-col gap-3">
          <Select<BmrFormula> label={t('formula')} value={settings.bmrFormula} onChange={(v) => update({ bmrFormula: v })} options={(['mifflin', 'harris', 'katch'] as const).map((f) => ({ value: f, label: t(`f_${f}`) }))} />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[12px] bg-bg2 p-3"><div className="text-[11px] text-ink3">{t('bmrLabel')}</div><div className="num text-[18px] font-semibold">{bmrVal ?? '—'}</div></div>
            <div className="rounded-[12px] bg-bg2 p-3"><div className="text-[11px] text-ink3">{t('tdeeLabel')}</div><div className="num text-[18px] font-semibold">{tdeeVal ?? '—'}</div></div>
            <div className="rounded-[12px] bg-mintsoft p-3"><div className="text-[11px] text-ink3">{t('suggested')}</div><div className="num text-[18px] font-semibold text-mint">{sugg ?? '—'}</div></div>
          </div>
          {!bmrVal && <div className="text-[12px] text-warn">{settings.bmrFormula === 'katch' ? t('needBodyFat') : t('needSex')}</div>}
          {sugg != null && (
            <Button variant="secondary" disabled={sugg === settings.kcalBudget} onClick={async () => { await update({ kcalBudget: Math.max(800, sugg) }); toast(t('saved')); }}>
              {t('apply')} · {sugg} kcal
            </Button>
          )}
          <p className="text-[11px] leading-relaxed text-ink3">{t('energyDisclaimer')}</p>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('profile')}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Select<Sex> label={t('sex')} value={settings.sex} onChange={(v) => update({ sex: v })} options={[{ value: 'unset', label: t('sexUnset') }, { value: 'male', label: t('sexMale') }, { value: 'female', label: t('sexFemale') }]} />
          <NumberSetting label={t('age')} field="age" min={13} max={110} />
          <NumberSetting label={t('height')} field="heightCm" min={100} max={250} step={0.5} />
          <NumberSetting label={`${t('bodyFat')} (${t('optional')})`} field="bodyFatPct" min={3} max={60} step={0.5} nullable />
          <NumberSetting label={t('startWeight')} field="startWeightKg" min={30} max={300} step={0.1} />
          <TextInput label={t('startDate')} type="date" value={settings.startDate} onChange={(e) => e.target.value && update({ startDate: e.target.value })} />
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <Select<ActivityLevel> label={t('activityLevel')} value={settings.activityLevel} onChange={(v) => update({ activityLevel: v })} options={(['sedentary', 'light', 'moderate', 'active', 'very_active'] as const).map((l) => ({ value: l, label: t(`lvl_${l}`) }))} />
          <TextInput
            label={t('goals')}
            value={goalsText}
            hint={t('goalsHint')}
            error={goalsErr}
            onChange={(e) => setGoalsText(e.target.value)}
            onBlur={() => {
              const parts = goalsText.split(/[,\s]+/).filter(Boolean).map(Number);
              if (!parts.length || parts.length > 10 || parts.some((n) => !(n >= 30 && n <= 300))) return setGoalsErr(t('errRange', { a: 30, b: 300 }));
              setGoalsErr(null);
              update({ goalWeightsKg: [...new Set(parts)].sort((a, b) => b - a) });
            }}
          />
        </div>
      </Card>

      <SheetsCard />

      <HealthCard />

      <AiCard />

      <Card>
        <SectionTitle>{t('data')}</SectionTitle>
        <div className="mb-3 flex gap-3 rounded-[12px] bg-mintsoft p-3 text-[13px] leading-relaxed text-ink2">
          <Shield size={18} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
          {t('privacyNote')}
        </div>
        <div className="flex flex-col gap-2.5">
          <Button onClick={doExport}><Download size={18} />{t('exportData')}</Button>
          <div className="text-center text-[12px] text-ink3">{settings.lastExportAt ? t('lastExport', { d: `${fmtDate(settings.lastExportAt, { day: 'numeric', month: 'short', year: 'numeric' })} ${fmtTime(settings.lastExportAt)}` }) : t('neverExported')}</div>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={18} />{t('importData')}</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="mt-2 flex items-start gap-3 rounded-[12px] p-3 text-[12px] text-ink2">
            <HardDrive size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <div className="font-semibold text-ink">{t('storage')}</div>
              {persisted ? t('storagePersisted') : t('storageNotPersisted')}
              {persisted === false && navigator.storage?.persist && (
                <button type="button" className="mt-1 block font-semibold text-mint" onClick={async () => setPersisted(await navigator.storage.persist())}>
                  {t('requestPersist')}
                </button>
              )}
            </div>
          </div>
          <Button variant="danger" className="mt-2" onClick={() => { setWipeText(''); setWipeOpen(true); }}><Trash2 size={18} />{t('wipeData')}</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('about')}</SectionTitle>
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink2">
          <p>{t('installHint')}</p>
          <p>{t('healthNote')}</p>
          <p className="text-ink3">{t('medicalDisclaimer')}</p>
          <p className="text-[12px] text-ink3">FORM · {t('version')} {__APP_VERSION__}</p>
        </div>
      </Card>

      <Sheet open={!!pending} onClose={() => setPending(null)} title={t('importData')}>
        {pending && (
          <div className="flex flex-col gap-3 pb-2">
            <p className="text-[14px] text-ink2">{t('importPreview', backupCounts(pending))}</p>
            <Button onClick={() => doImport('merge')}>{t('importMerge')}</Button>
            <Button variant="danger" onClick={() => doImport('replace')}>{t('importReplace')}</Button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        title={t('wipeData')}
        footer={
          <Button
            variant="danger"
            className="w-full"
            disabled={wipeText.trim() !== t('wipeWord')}
            onClick={async () => {
              await wipeAll(db);
              setWipeOpen(false);
              toast(t('wiped'));
            }}
          >
            <Trash2 size={18} />
            {t('wipeData')}
          </Button>
        }
      >
        <TextInput label={t('wipeConfirm', { w: t('wipeWord') })} value={wipeText} onChange={(e) => setWipeText(e.target.value)} autoComplete="off" />
      </Sheet>
    </div>
  );
}
