'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useWallet } from '@/components/wallet/wallet-provider';
import { normalizeHandle } from '@/lib/profile';
import { useCreateProfile, useHandleAvailability } from '@/hooks/use-profile-onboarding';
import { AvatarPicker } from '@/components/AvatarPicker';
import { type FaceId } from '@/lib/avatar';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * One-field onboarding, right on the landing hero. Type a handle, tap once, and we silently
 * provision a wallet (Face ID / dev), fund it, write genesis, and stamp the handle on-chain,
 * then drop you into the app. Returning users just get a shortcut into their app.
 *
 * NOTE: the heavy chain (registry → contracts → wallet → stellar-sdk) is DYNAMICALLY imported
 * inside the shared hooks. Statically importing it into this client component would pull stellar-sdk
 * into the server-rendered landing page and break the client-reference (renders as undefined).
 */
export function LandingOnboard() {
  const t = useTranslations();
  const { profile } = useWallet();
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [face, setFace] = useState<FaceId | undefined>();
  const avail = useHandleAvailability(handle);
  const { creating, createProfile } = useCreateProfile();

  // Returning user: skip straight to the app.
  if (profile) {
    return (
      <Link href="/app" className="inline-flex">
        <Button variant="flow" size="lg">
          {t('onboard.openApp')} <ArrowRight className="size-4" />
        </Button>
      </Link>
    );
  }

  return (
    <form
      className="w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        void createProfile(handle, face, 'landing').then((created) => {
          if (created) router.push('/app');
        });
      }}
    >
      <div className="glass flex items-center gap-2 rounded-full p-1.5">
        <span className="pl-3 text-lg text-muted-foreground">@</span>
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={t('onboard.placeholder')}
          aria-label={t('onboard.ariaLabel')}
          aria-describedby="landing-handle-status"
          className="h-11 flex-1 border-0 bg-transparent focus-visible:ring-0"
        />
        <Button type="submit" variant="flow" size="md" disabled={creating || avail === 'taken'} className="shrink-0">
          {creating ? t('onboard.creating') : t('onboard.startFree')}
          {!creating && <ArrowRight className="size-4" />}
        </Button>
      </div>
      <p id="landing-handle-status" aria-live="polite" className="mt-2 h-4 pl-4 text-xs">
        {avail === 'checking' && <span className="text-muted-foreground">{t('onboard.checking')}</span>}
        {avail === 'free' && <span className="text-secondary">{t('onboard.handleFree', { handle: normalizeHandle(handle) })}</span>}
        {avail === 'taken' && <span className="text-destructive">{t('onboard.handleTaken', { handle: normalizeHandle(handle) })}</span>}
        {avail === 'idle' && <span className="text-muted-foreground">{t('onboard.pill')}</span>}
      </p>
      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t('onboard.pickFace')}</p>
        <AvatarPicker value={face} onChange={setFace} size={40} />
      </div>
    </form>
  );
}
