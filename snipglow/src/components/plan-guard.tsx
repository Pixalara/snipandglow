'use client';

import type { ReactNode } from 'react';
import type { PlanTier } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

const PLAN_RANK: Record<PlanTier, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

const planLabels: Record<PlanTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export interface PlanGuardProps {
  requiredPlan: PlanTier;
  currentPlan: PlanTier;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PlanGuard({ requiredPlan, currentPlan, children, fallback }: PlanGuardProps) {
  const hasAccess = PLAN_RANK[currentPlan] >= PLAN_RANK[requiredPlan];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Card className="mx-auto max-w-sm text-center">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2">
          <Lock className="size-5" />
          Upgrade Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This feature requires the <strong>{planLabels[requiredPlan]}</strong> plan or higher.
          You are currently on the <strong>{planLabels[currentPlan]}</strong> plan.
        </p>
        <Button size="sm">Upgrade to {planLabels[requiredPlan]}</Button>
      </CardContent>
    </Card>
  );
}
