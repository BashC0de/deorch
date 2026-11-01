'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { QRCodeSVG } from 'qrcode.react';
import { registerDevice, createPairingChallenge, fetchDevice } from '@/lib/api/devices';
import type { Device } from '@/lib/types/api';

type Step = 'register' | 'qr' | 'success';

interface PairingState {
  device: Device | null;
  challengeToken: string;
  expiresAt: Date | null;
}

export function ConnectMachineModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('register');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingState>({
    device: null,
    challengeToken: '',
    expiresAt: null,
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    setStep('register');
    setDeviceName('');
    setLoading(false);
    setError(null);
    setPairing({ device: null, challengeToken: '', expiresAt: null });
    setTimeLeft(0);
    setCopied(false);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!pairing.expiresAt || step !== 'qr') return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((pairing.expiresAt!.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) setError('Pairing code expired. Please try again.');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pairing.expiresAt, step]);

  // Poll for device status change (PENDING → PAIRED)
  useEffect(() => {
    if (step !== 'qr' || !pairing.device) return;
    const poll = async () => {
      try {
        const updated = await fetchDevice(pairing.device!.id);
        if (updated.status !== 'PENDING') {
          setStep('success');
          void queryClient.invalidateQueries({ queryKey: ['devices'] });
        }
      } catch {
        // Ignore polling errors
      }
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [step, pairing.device, queryClient]);

  async function handleRegister() {
    if (!deviceName.trim()) {
      setError('Device name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const device = await registerDevice(deviceName.trim());
      const challenge = await createPairingChallenge(device.id);
      setPairing({
        device,
        challengeToken: challenge.challenge_token,
        expiresAt: new Date(challenge.expires_at),
      });
      setStep('qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(pairing.challengeToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const qrPayload = pairing.device
    ? `deorch://pair?token=${encodeURIComponent(pairing.challengeToken)}&device_id=${pairing.device.id}`
    : '';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Dialog.Trigger asChild>
        <button className="rounded-md bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-primary/90 transition-colors min-h-[36px]">
          Connect Machine
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-subtle bg-surface-raised p-6 shadow-2xl">
          <Dialog.Title className="text-base font-semibold mb-4">
            {step === 'register' && 'Connect a Machine'}
            {step === 'qr' && 'Pair Your Device'}
            {step === 'success' && 'Device Paired'}
          </Dialog.Title>

          {error && (
            <div className="mb-4 rounded-md bg-status-error/10 border border-status-error/20 px-3 py-2 text-xs text-status-error">
              {error}
            </div>
          )}

          {step === 'register' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="device-name" className="block text-xs text-text-muted mb-1.5">
                  Device Name
                </label>
                <input
                  id="device-name"
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                  placeholder="My Laptop"
                  className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
                  autoFocus
                />
              </div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full rounded-md bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 disabled:opacity-50 transition-colors min-h-[44px]"
              >
                {loading ? 'Registering...' : 'Register Device'}
              </button>
            </div>
          )}

          {step === 'qr' && (
            <div className="space-y-4">
              <p className="text-xs text-text-muted">
                Scan this QR code with the DeOrch companion, or copy the pairing code below and run:
              </p>
              <code className="block text-xs text-text-muted bg-surface-subtle rounded px-2 py-1.5">
                deorch pair --device-id {pairing.device?.id} --token &lt;code&gt;
              </code>

              <div className="flex justify-center py-2">
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={qrPayload} size={180} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-text-muted">Pairing Code</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={pairing.challengeToken}
                    className="flex-1 rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs font-mono text-text-secondary select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Waiting for companion to connect...</span>
                <span className={timeLeft < 60 ? 'text-status-warning' : ''}>
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-status-success/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Device paired successfully!</p>
                <p className="text-xs text-text-muted mt-1">
                  &ldquo;{pairing.device?.name}&rdquo; is now connected. Run <code className="text-text-secondary">deorch start</code> to begin.
                </p>
              </div>
              <Dialog.Close asChild>
                <button className="w-full rounded-md bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors min-h-[44px]">
                  Done
                </button>
              </Dialog.Close>
            </div>
          )}

          {step !== 'success' && (
            <Dialog.Close asChild>
              <button className="absolute right-4 top-4 text-text-muted hover:text-text-primary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
