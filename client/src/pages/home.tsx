import type { ReactNode } from "react";
import { useOffline } from "@/hooks/use-offline";
import { nonNeg, useDashboard, useTravelPlan } from "@/components/travel/api";
import { formatLocalTime, formatLongDate, timeZoneAbbreviation, useLocalDay } from "@/components/travel/local-date";
import { Page, PageHeader, StateMessage } from "@/components/travel/primitives";
import { CaptureRow } from "@/components/travel/today/capture-row";
import { EatenTodayPanel, EatenTodaySkeleton } from "@/components/travel/today/eaten-today-panel";
import { NextUpPanel } from "@/components/travel/today/next-up-panel";
import { planSubtitle } from "@/components/travel/today/plan-subtitle";
import { RemainingPanel, RemainingSkeleton } from "@/components/travel/today/remaining-panel";
import { RetryButton, useIsDesktop } from "@/components/travel/today/shared";
import { useWaterControl } from "@/components/travel/today/use-water";
import { WaterPanel, WaterSkeleton } from "@/components/travel/today/water-panel";

const DEFAULT_WATER_TARGET = 8;

/**
 * Today: where you are, what's left today, and the next good meal decision.
 * Core loop: Today -> capture/correct a meal -> remaining-day plan.
 */
export default function HomePage() {
  const { today, timezone, now } = useLocalDay();
  const dashboard = useDashboard(today, timezone);
  const plan = useTravelPlan(today, timezone);
  const { isOffline } = useOffline();
  const isDesktop = useIsDesktop();
  const water = useWaterControl(today, timezone);

  const eyebrow = `${formatLongDate(today)} · ${formatLocalTime(timezone, now)} ${timeZoneAbbreviation(timezone, now)}`;
  const data = dashboard.data;
  const retryDashboard = () => void dashboard.refetch();

  let remaining: ReactNode;
  let eaten: ReactNode = null;
  let hydration: ReactNode = null;

  if (data) {
    const waterTarget = nonNeg(data.stats?.waterTarget) || DEFAULT_WATER_TARGET;
    remaining = (
      <RemainingPanel
        data={data}
        today={today}
        refreshFailed={dashboard.isError}
        refreshing={dashboard.isFetching}
        onRetry={retryDashboard}
      />
    );
    eaten = <EatenTodayPanel meals={data.nutritionLog?.meals ?? []} today={today} />;
    hydration = (
      <WaterPanel
        glasses={Math.round(nonNeg(data.stats?.water))}
        target={Math.round(waterTarget)}
        reason={data.stats?.waterTargetReason}
        isOffline={isOffline}
        onAdd={water.add}
        onRemove={water.remove}
      />
    );
  } else if (isOffline) {
    remaining = (
      <StateMessage
        tone="offline"
        title="Today's totals will load when you're back online"
        body="Logging still works. Meals you save are kept on this device and sync when you reconnect."
      />
    );
  } else if (dashboard.isError) {
    remaining = (
      <StateMessage
        tone="error"
        title="Today's totals didn't load"
        body="You can still log meals below; they'll count as soon as this loads."
        action={<RetryButton onRetry={retryDashboard} busy={dashboard.isFetching} />}
      />
    );
  } else {
    remaining = <RemainingSkeleton />;
    eaten = <EatenTodaySkeleton />;
    hydration = <WaterSkeleton />;
  }

  const capture = <CaptureRow today={today} />;
  const nextUp = <NextUpPanel plan={plan} today={today} isOffline={isOffline} />;

  return (
    <Page wide>
      <PageHeader eyebrow={eyebrow} title="Today" subtitle={planSubtitle(plan, isOffline)} />

      {isDesktop ? (
        // Two columns on md+: the day's numbers and meals on the left, the plan beside them.
        <div className="grid items-start gap-6 md:grid-cols-5">
          <div className="flex min-w-0 flex-col gap-6 md:col-span-3">
            {remaining}
            {capture}
            {eaten}
          </div>
          <div className="flex min-w-0 flex-col gap-6 md:col-span-2">
            {nextUp}
            {hydration}
          </div>
        </div>
      ) : (
        // One column; DOM order matches reading and focus order.
        <div className="flex flex-col gap-4">
          {remaining}
          {capture}
          {nextUp}
          {eaten}
          {hydration}
        </div>
      )}
    </Page>
  );
}
