import React from 'react';
import { MetricCard } from './MetricCard';
import { MetricDefinition, MetricContext } from '../../metrics/registry';
import { useDashboardPeriod } from '../../contexts/DashboardPeriodContext';

interface MetricAction {
  actionLabel: string;
  actionPath: string;
}

interface MetricRowProps {
  metrics: MetricDefinition[];
  ctx: MetricContext;
  // Optional per-metric "View X" links, keyed by metric id.
  actionMap?: Record<string, MetricAction>;
  heading?: string;
  subheading?: string;
  // Grid classes for the card row. Defaults to the six-up layout the
  // Requestor "My Requests" panel uses; override for other card counts.
  className?: string;
}

/**
 * Renders a registry-driven row of MetricCards. Reads the period context
 * itself (effectiveScope / resolveMetricRange), so callers only supply the
 * metric list, the compute context, and optional action links — the same
 * grid + compute loop that was previously hand-copied into each dashboard.
 *
 * Must be rendered inside a DashboardPeriodProvider (like every metric surface).
 */
export const MetricRow: React.FC<MetricRowProps> = ({
  metrics,
  ctx,
  actionMap = {},
  heading,
  subheading,
  className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4',
}) => {
  const { resolveMetricRange, effectiveScope } = useDashboardPeriod();

  return (
    <>
      {heading && <h2 className="text-lg font-bold text-slate-800 mb-1">{heading}</h2>}
      {subheading && <p className="text-sm text-slate-500 mb-4">{subheading}</p>}
      <div className={className}>
        {metrics.map(metric => {
          const scope = effectiveScope(metric);
          const range = resolveMetricRange(metric);
          const value = metric.compute(ctx, range);
          const action = actionMap[metric.id];
          return (
            <MetricCard
              key={metric.id}
              metric={metric}
              ctx={ctx}
              scope={scope}
              value={value}
              actionLabel={action?.actionLabel}
              actionPath={action?.actionPath}
            />
          );
        })}
      </div>
    </>
  );
};
