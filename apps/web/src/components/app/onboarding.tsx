'use client';

import { useState } from 'react';
import { normalizeHandle } from '@/lib/profile';
import { useCreateProfile, useHandleAvailability } from '@/hooks/use-profile-onboarding';
import { useTranslations } from '@/lib/i18n';
import { Crest } from '@/components/brand/crest';
import { AvatarPicker } from '@/components/AvatarPicker';
import { type FaceId } from '@/lib/avatar';
import { asset } from '@/lib/assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Onboarding() {
  const t = useTranslations();
  const [handle, setHandle] = useState('');
  const [face, setFace] = useState<FaceId | undefined>();
  const avail = useHandleAvailability(handle);
  const { creating, createProfile } = useCreateProfile();

  return (
    <div className="relative container flex max-w-md flex-col items-center gap-8 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [mask-image:radial-gradient(circle_at_top,black,transparent_70%)]"
        style={{ backgroundImage: `url(${asset('backgrounds/app-bg.png')})`, backgroundSize: 'cover', backgroundPosition: 'top' }}
      />
      <div className="text-center">
        <p className="eyebrow mb-3">{t('onboard.eyebrow')}</p>
        <h1 className="text-3xl font-semibold">{t('onboard.title')}</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground text-balance">
          {t('onboard.subtitle')}
        </p>
      </div>

      <Crest address={handle ? `profile-${handle}` : 'new-profile'} size={160} points={6} animate />

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t('onboard.pickFace')}</p>
        <AvatarPicker value={face} onChange={setFace} size={48} />
      </div>

      <form
        className="flex w-full flex-col items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void createProfile(handle, face, 'app');
        }}
      >
        <Input
          autoFocus
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={t('onboard.placeholder')}
          className="text-center"
          aria-label={t('onboard.ariaLabel')}
          aria-describedby="handle-status"
        />
        <p id="handle-status" aria-live="polite" className="h-4 text-xs">
          {avail === 'checking' && <span className="text-muted-foreground">{t('onboard.checking')}</span>}
          {avail === 'free' && <span className="text-secondary">{t('onboard.handleFree', { handle: normalizeHandle(handle) })}</span>}
          {avail === 'taken' && <span className="text-destructive">{t('onboard.handleTaken', { handle: normalizeHandle(handle) })}</span>}
        </p>
        <Button type="submit" size="lg" disabled={creating || avail === 'taken'} className="w-full">
          {creating ? t('onboard.creating') : t('onboard.submit')}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground text-balance">
        {t('onboard.footer')}
      </p>
    </div>
  );
}
