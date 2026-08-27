'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { PlanTier } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { planLabel } from '@/lib/subscription';
import { Lock } from 'lucide-react';

const PLAN_RANK: Record<PlanTier, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

// Plan names come from the shared planLabel() helper on purpose. This component
// used to keep its own map reading Starter / Pro / Enterprise, which contradicted
// the names customers actually see everywhere else (Essentials / Pro / Growth).

/** Where an owner goes to compare plans. Plan tier is changed by the platform
 *  team, so this is a pricing page rather than a self-serve upgrade button. */
const PRICING_URL = 'https://snipandglow.com/#pricing';

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
          This feature requires the <strong>{planLabel(requiredPlan)}</strong> plan or higher.
          You are currently on the <strong>{planLabel(currentPlan)}</strong> plan.
        </p>
        {/* This was a <Button> with no onClick and no href — it looked like a
            call to action and did absolutely nothing when clicked. */}
        <Link
          href={PRICING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'default', size: 'sm' })}
        >
          See {planLabel(requiredPlan)} plan
        </Link>
      </CardContent>
    </Card>
  );
}
