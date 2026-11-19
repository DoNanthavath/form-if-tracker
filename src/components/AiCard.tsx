import { useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Card, SectionTitle, Select, TextInput } from './ui';
import { useApp } from '../app/context';
import { useAiConfig, writeAi } from '../hooks/useDeviceConfig';
import { AI_MODELS, type AiModelId } from '../lib/ai';
import { useToast } from './Toast';

export function AiCard() {
  const { t } = useApp();
  const ai = useAiConfig();
  const toast = useToast();
  const [key, setKey] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const masked = ai.apiKey ? `${ai.apiKey.slice(0, 10)}…${ai.apiKey.slice(-4)}` : '';

  const save = async () => {
    const k = key.trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k)) return setErr(t('errorGeneric'));
    setErr(null);
    await writeAi({ apiKey: k });
    setKey('');
    toast(t('saved'));
  };

  return (
    <Card>
      <SectionTitle action={ai.apiKey ? <Badge>✓</Badge> : undefined}>
        <span className="inline-flex items-center gap-2"><Sparkles size={18} className="text-mint" />{t('aiTitle')}</span>
      </SectionTitle>
      <p className="text-[13px] leading-relaxed text-ink2">{t('aiIntro')}</p>
      <div className="mt-4 flex flex-col gap-3">
        {ai.apiKey ? (
          <div className="flex items-center justify-between gap-2 rounded-[12px] bg-bg2 p-3">
            <code className="truncate text-[13px] text-ink2">{masked}</code>
            <Button variant="ghost" className="!min-h-[38px] !px-2 text-danger" onClick={() => writeAi({ apiKey: '' })}><Trash2 size={16} />{t('aiRemoveKey')}</Button>
          </div>
        ) : (
          <>
            <TextInput label={t('aiKey')} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" hint={t('aiKeyHint')} error={err} />
            <Button disabled={!key.trim()} onClick={save}>{t('save')}</Button>
          </>
        )}
        <Select<AiModelId> label={t('aiModel')} value={ai.model} onChange={(v) => writeAi({ model: v })} options={AI_MODELS.map((m) => ({ value: m.id, label: `${m.label} · ${m.note}` }))} />
        <p className="text-[11px] leading-relaxed text-ink3">{t('aiPrivacy')}</p>
      </div>
    </Card>
  );
}
