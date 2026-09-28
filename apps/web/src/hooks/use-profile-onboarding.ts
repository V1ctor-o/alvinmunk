'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useWallet } from '@/components/wallet/wallet-provider';
import { normalizeHandle, type Profile } from '@/lib/profile';
import { type FaceId } from '@/lib/avatar';
import { useTranslations } from '@/lib/i18n';
import { humanizeError } from '@/lib/utils';
import { identify, track, trackError } from '@/lib/track';

export type HandleAvailability = 'idle' | 'checking' | 'free' | 'taken';

export function useHandleAvailability(handle: string): HandleAvailability {
  const [availability, setAvailability] = useState<HandleAvailability>('idle');
  const normalized = normalizeHandle(handle);

  useEffect(() => {
    if (normalized.length < 3) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const { isHandleAvailable } = await import('@/lib/registry');
        const free = await isHandleAvailable(normalized);
        if (alive) setAvailability(free ? 'free' : 'taken');
      } catch {
        if (alive) setAvailability('idle');
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [normalized]);

  return availability;
}

export function useCreateProfile() {
  const { connect, setProfile } = useWallet();
  const t = useTranslations();
  const [creating, setCreating] = useState(false);

  async function createProfile(handle: string, face?: FaceId, from: 'landing' | 'app' = 'app'): Promise<boolean> {
    const h = normalizeHandle(handle);
    if (h.length < 3) {
      toast.error(t('onboard.errShort'));
      return false;
    }
    setCreating(true);
    try {
      const w = await connect();
      const { isHandleAvailable, claimHandle } = await import('@/lib/registry');
      if (!(await isHandleAvailable(h))) {
        toast.error(t('onboard.errTaken', { handle: h }));
        return false;
      }
      const tx = w.kind === 'passkey' ? undefined : await import('@/lib/genesis').then(({ recordGenesis }) => recordGenesis(w, h));
      await claimHandle(w, h);
      const p: Profile = {
        handle: h,
        address: w.address,
        createdAt: Date.now(),
        genesisTx: tx,
        avatar: face ? { kind: 'face', id: face } : undefined,
      };
      setProfile(p);
      identify(w.address, { handle: h, walletKind: w.kind });
      track('profile_created', { walletKind: w.kind, from });
      toast.success(t('onboard.success', { handle: h }));
      return true;
    } catch (error) {
      console.error('🛑 createProfile failed →', error);
      trackError(error, { flow: 'create_profile', from });
      toast.error(humanizeError(error));
      return false;
    } finally {
      setCreating(false);
    }
  }

  return { creating, createProfile };
}
