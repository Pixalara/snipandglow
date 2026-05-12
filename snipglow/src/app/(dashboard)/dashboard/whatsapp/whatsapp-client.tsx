'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  Crown,
  CheckCircle2,
  Smartphone,
  Rocket,
  BarChart3,
  Lock,
  Sparkles,
  Send,
  Users,
  Zap,
} from 'lucide-react';
import type { PlanTier } from '@/types';

// =============================================================================
// Global type declarations for Facebook SDK
// =============================================================================

declare global {
  interface Window {
    fbAsyncInit: () => void;
  }
  // eslint-disable-next-line no-var
  var FB: {
    init: (params: {
      appId: string;
      autoLogAppEvents: boolean;
      xfbml: boolean;
      version: string;
    }) => void;
    login: (
      callback: (response: { authResponse?: { code: string } }) => void,
      options: Record<string, unknown>
    ) => void;
  };
}

// =============================================================================
// WhatsApp Connect Client Component
// =============================================================================

interface WhatsAppClientProps {
  planTier: PlanTier;
}

export function WhatsAppClient({ planTier }: WhatsAppClientProps) {
  const hasAccess = planTier === 'pro' || planTier === 'enterprise';

  if (!hasAccess) {
    return <UpgradeCard currentPlan={planTier} />;
  }

  return <WhatsAppConnectCard />;
}

// =============================================================================
// WhatsApp Connect Card (Pro/Enterprise users)
// =============================================================================

function WhatsAppConnectCard() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Skip if already loaded
    if (typeof window !== 'undefined' && typeof FB !== 'undefined') {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID || 'YOUR_APP_ID',
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      setSdkLoaded(true);
    };

    // Load SDK script
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  function handleConnectWhatsApp() {
    if (!sdkLoaded || typeof FB === 'undefined') {
      // Graceful degradation — inform user SDK isn't ready
      alert('Facebook SDK is still loading. Please try again in a moment.');
      return;
    }

    setConnecting(true);

    FB.login(
      function (response) {
        if (response.authResponse) {
          const code = response.authResponse.code;
          // TODO: Send code to backend to exchange for WABA token
          console.log('Auth code received:', code);
          setConnected(true);
        }
        setConnecting(false);
      },
      {
        config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID || 'YOUR_CONFIG_ID',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      }
    );
  }

  const features = [
    {
      icon: Smartphone,
      label: 'Messages from your own number',
    },
    {
      icon: Rocket,
      label: 'Direct delivery via Meta Cloud API',
    },
    {
      icon: BarChart3,
      label: 'Real-time delivery status tracking',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 p-6">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <MessageCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">WhatsApp Connect</h1>
            <p className="text-sm text-muted-foreground">
              Connect your own WhatsApp Business number for direct messaging
            </p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-emerald-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-green-400/5" />
      </div>

      {/* Connect Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500">
              <MessageCircle className="size-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">WhatsApp Business</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {connected ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">Connected Successfully</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your WhatsApp Business number is now linked. Messages will be sent from your own number.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Connect your own WhatsApp Business number for:
                </p>
              </div>

              <div className="space-y-3">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.label}
                      className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{feature.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                  size="lg"
                  onClick={handleConnectWhatsApp}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="size-4" />
                      Connect WhatsApp
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Or continue using the default Snip &amp; Glow number
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">How it works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Click &quot;Connect WhatsApp&quot; to start Meta&apos;s Embedded Signup</li>
          <li>Log in with your Facebook account and select your Business</li>
          <li>Verify your WhatsApp Business number</li>
          <li>Once connected, all messages will be sent from your own number</li>
        </ol>
      </div>
    </div>
  );
}

// =============================================================================
// Upgrade Card (Starter users)
// =============================================================================

function UpgradeCard({ currentPlan }: { currentPlan: PlanTier }) {
  const proFeatures = [
    { icon: MessageCircle, label: 'Your own WhatsApp Business number' },
    { icon: Send, label: 'Broadcast campaigns to customers' },
    { icon: Users, label: 'Multi-branch management' },
    { icon: BarChart3, label: 'Advanced analytics & reports' },
    { icon: Zap, label: 'Priority support' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 p-6">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <MessageCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">WhatsApp Connect</h1>
            <p className="text-sm text-muted-foreground">
              Connect your own WhatsApp Business number for direct messaging
            </p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-emerald-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-green-400/5" />
      </div>

      {/* Upgrade Card */}
      <div className="relative overflow-hidden rounded-xl border border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/80 via-rose-50/50 to-orange-50/30 dark:from-amber-950/20 dark:via-rose-950/10 dark:to-orange-950/10">
        {/* Current plan badge */}
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
            <span className="size-1.5 rounded-full bg-gray-400" />
            {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
          </span>
        </div>

        <div className="p-8 space-y-6">
          {/* Icon & Heading */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-rose-400/20 dark:from-amber-500/20 dark:to-rose-500/20">
              <Crown className="size-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Upgrade to Pro</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Unlock WhatsApp Business integration and send messages from your own number.
                Build stronger customer relationships with direct communication.
              </p>
            </div>
          </div>

          {/* Feature List */}
          <div className="space-y-3 max-w-sm mx-auto">
            {proFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.label} className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 dark:bg-amber-900/30">
                    <Icon className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{feature.label}</span>
                </div>
              );
            })}
          </div>

          {/* Comparison */}
          <div className="rounded-xl border border-amber-200/50 dark:border-amber-800/30 bg-white/60 dark:bg-gray-900/40 p-4 max-w-sm mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3 text-xs">
              <div className="space-y-2">
                <p className="font-semibold text-muted-foreground uppercase tracking-wider">Starter</p>
                <div className="space-y-1.5 text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Lock className="size-3" /> Shared number
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Lock className="size-3" /> Basic templates
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Lock className="size-3" /> Single branch
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pro</p>
                <div className="space-y-1.5 text-foreground">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-500" /> Own number
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-500" /> Campaigns
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-500" /> Multi-branch
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            <Link href="/dashboard/settings" className="w-full max-w-sm">
              <Button
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:from-amber-600 hover:to-rose-600 shadow-lg shadow-amber-500/20"
                size="lg"
              >
                <Sparkles className="size-4" />
                Upgrade Now
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              Manage your subscription in Settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
