import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button, Sheet } from './ui';
import { useApp } from '../app/context';

interface Req { title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void }
const Ctx = createContext<(r: Omit<Req, 'resolve'>) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const [req, setReq] = useState<Req | null>(null);
  const ask = useCallback((r: Omit<Req, 'resolve'>) => new Promise<boolean>((resolve) => setReq({ ...r, resolve })), []);
  const finish = (v: boolean) => {
    req?.resolve(v);
    setReq(null);
  };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Sheet
        open={!!req}
        onClose={() => finish(false)}
        title={req?.title ?? ''}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => finish(false)}>
              {t('cancel')}
            </Button>
            <Button variant={req?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => finish(true)}>
              {req?.confirmLabel ?? t('confirm')}
            </Button>
          </div>
        }
      >
        {req?.body && <div className="pb-2 text-[14px] leading-relaxed text-ink2">{req.body}</div>}
      </Sheet>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
