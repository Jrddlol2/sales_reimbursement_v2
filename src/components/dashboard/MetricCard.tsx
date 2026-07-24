import React from 'react';
import { KPICard } from './KPICard';
import { MetricDefinition, MetricContext } from '../../metrics/registry';
import { scopeLabel, TimeScope } from '../../metrics/timeScope';
import { formatPHP } from '../../utils';
import {
  Clock, ChartPieSlice, CurrencyCircleDollar, ListChecks, Icon,
} from '@phosphor-icons/react';

const iconForFormat = (format: MetricDefinition['format']): Icon => {
  switch (format) {
    case 'currency': return CurrencyCircleDollar;
    case 'percent': return ChartPieSlice;
    case 'hours': return Clock;
    default: return ListChecks;
  }
};

export const formatMetricValue = (value: number | string, format: MetricDefinition['format']): string => {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency': return formatPHP(value);
    case 'percent': return `${value}%`;
    case 'hours': return `${value}h`;
    default: return String(value);
  }
};

interface MetricCardProps {
  metric: MetricDefinition;
  ctx: MetricContext;
  scope: TimeScope;
  value: number | string;
  actionLabel?: string;
  actionPath?: string;
  onClick?: () => void;
}

/**
 * Generic renderer for any MetricDefinition. Reads the metric's own scope to
 * print the period sub-label automatically — nothing about a card's label or
 * period is hand-typed at the call site. Adding a metric to the registry is
 * enough for it to render correctly here.
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  metric, value, scope, actionLabel, actionPath, onClick,
}) => {
  return (
    <KPICard
      title={metric.label}
      value={formatMetricValue(value, metric.format)}
      icon={metric.icon || iconForFormat(metric.format)}
      variant={metric.variant}
      description={metric.description}
      additionalContext={scopeLabel(scope)}
      actionLabel={actionLabel}
      actionPath={actionPath}
      onClick={onClick}
    />
  );
};
