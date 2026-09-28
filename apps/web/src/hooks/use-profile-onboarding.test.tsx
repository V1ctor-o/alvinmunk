import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateProfile, useHandleAvailability, type HandleAvailability } from './use-profile-onboarding';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(), setProfile: vi.fn(), isHandleAvailable: vi.fn(),
  claimHandle: vi.fn(), recordGenesis: vi.fn(), identify: vi.fn(),
  track: vi.fn(), trackError: vi.fn(), error: vi.fn(), success: vi.fn(),
}));

vi.mock('@/components/wallet/wallet-provider', () => ({
  useWallet: () => ({ connect: mocks.connect, setProfile: mocks.setProfile }),
}));
vi.mock('@/lib/registry', () => ({
  isHandleAvailable: mocks.isHandleAvailable, claimHandle: mocks.claimHandle,
}));
vi.mock('@/lib/genesis', () => ({ recordGenesis: mocks.recordGenesis }));
vi.mock('@/lib/track', () => ({
  identify: mocks.identify, track: mocks.track, trackError: mocks.trackError,
}));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success } }));

describe('profile onboarding hooks', () => {
  let element: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    element = document.createElement('div');
    document.body.appendChild(element);
    root = createRoot(element);
    mocks.connect.mockResolvedValue({ kind: 'passkey', address: 'GTEST' });
    mocks.isHandleAvailable.mockResolvedValue(true);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    element.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('debounces availability and reports a taken handle', async () => {
    let availability: HandleAvailability = 'idle';
    function View({ handle }: { handle: string }) {
      availability = useHandleAvailability(handle);
      return null;
    }
    mocks.isHandleAvailable.mockResolvedValue(false);
    await act(async () => root.render(<View handle="AB" />));
    expect(availability).toBe('idle');
    await act(async () => root.render(<View handle="@Taken" />));
    expect(availability).toBe('checking');
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(mocks.isHandleAvailable).toHaveBeenCalledWith('taken');
    expect(availability).toBe('taken');
  });

  it('refuses a handle taken after connecting and clears creating state', async () => {
    let hook!: ReturnType<typeof useCreateProfile>;
    function View() { hook = useCreateProfile(); return null; }
    await act(async () => root.render(<View />));
    mocks.isHandleAvailable.mockResolvedValue(false);
    let created = true;
    await act(async () => { created = await hook.createProfile('Taken'); });
    expect(created).toBe(false);
    expect(hook.creating).toBe(false);
    expect(mocks.claimHandle).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });

  it('skips genesis for a passkey and saves the selected face with analytics', async () => {
    let hook!: ReturnType<typeof useCreateProfile>;
    function View() { hook = useCreateProfile(); return null; }
    await act(async () => root.render(<View />));
    let created = false;
    await act(async () => { created = await hook.createProfile('Kaan', 'face-03', 'landing'); });
    expect(created).toBe(true);
    expect(mocks.recordGenesis).not.toHaveBeenCalled();
    expect(mocks.claimHandle).toHaveBeenCalledWith({ kind: 'passkey', address: 'GTEST' }, 'kaan');
    expect(mocks.setProfile).toHaveBeenCalledWith(expect.objectContaining({
      handle: 'kaan', address: 'GTEST', genesisTx: undefined,
      avatar: { kind: 'face', id: 'face-03' },
    }));
    expect(mocks.identify).toHaveBeenCalledWith('GTEST', { handle: 'kaan', walletKind: 'passkey' });
    expect(mocks.track).toHaveBeenCalledWith('profile_created', { walletKind: 'passkey', from: 'landing' });
  });

  it('reports a claim failure without saving a profile', async () => {
    let hook!: ReturnType<typeof useCreateProfile>;
    function View() { hook = useCreateProfile(); return null; }
    await act(async () => root.render(<View />));
    const failure = new Error('claim failed');
    mocks.claimHandle.mockRejectedValueOnce(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let created = true;
      await act(async () => { created = await hook.createProfile('kaan'); });
      expect(created).toBe(false);
      expect(hook.creating).toBe(false);
      expect(mocks.setProfile).not.toHaveBeenCalled();
      expect(mocks.trackError).toHaveBeenCalledWith(failure, { flow: 'create_profile', from: 'app' });
      expect(mocks.error).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
