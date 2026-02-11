import type { MetricsRecord, MetricsSummary, MetricsChartPoint, SetupTier } from '../types/metrics';
import { format, parseISO } from 'date-fns';

/** Summarise an array of metric records into a single summary. */
export function summariseMetrics(records: MetricsRecord[]): MetricsSummary {
  if (records.length === 0) {
    return {
      totalSetups: 0,
      setupsByTier: { ultimate: 0, premium: 0, standard: 0 },
      totalRevisions: 0,
      totalLaunches: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      variance: 0,
      variancePercent: 0,
      onTimeRate: 0,
      avgCompletionPercent: 0,
    };
  }

  const setupsByTier: Record<SetupTier, number> = { ultimate: 0, premium: 0, standard: 0 };
  let totalRevisions = 0;
  let totalLaunches = 0;
  let totalEstimated = 0;
  let totalActual = 0;
  let onTimeCount = 0;
  let completionSum = 0;

  for (const r of records) {
    setupsByTier.ultimate += r.setups.ultimate;
    setupsByTier.premium += r.setups.premium;
    setupsByTier.standard += r.setups.standard;
    totalRevisions += r.revisions;
    totalLaunches += r.launches;
    totalEstimated += r.estimatedHours;
    totalActual += r.actualHours;
    if (r.completedOnTime) onTimeCount++;
    completionSum += r.completionPercentage;
  }

  const totalSetups = setupsByTier.ultimate + setupsByTier.premium + setupsByTier.standard;
  const variance = totalActual - totalEstimated;
  const variancePercent = totalEstimated > 0 ? (variance / totalEstimated) * 100 : 0;

  return {
    totalSetups,
    setupsByTier,
    totalRevisions,
    totalLaunches,
    totalEstimatedHours: totalEstimated,
    totalActualHours: totalActual,
    variance,
    variancePercent,
    onTimeRate: (onTimeCount / records.length) * 100,
    avgCompletionPercent: completionSum / records.length,
  };
}

/** Convert records into chart-ready data points. */
export function toChartData(records: MetricsRecord[]): MetricsChartPoint[] {
  return records.map((r) => {
    const date = parseISO(r.periodStart);
    let label: string;

    if (r.scope === 'weekly') {
      label = `W${format(date, 'w')}`;
    } else if (r.scope === 'monthly') {
      label = format(date, 'MMM');
    } else {
      label = format(date, 'yyyy');
    }

    return {
      label,
      setups: r.setups.ultimate + r.setups.premium + r.setups.standard,
      revisions: r.revisions,
      launches: r.launches,
      estimated: r.estimatedHours,
      actual: r.actualHours,
      variance: r.actualHours - r.estimatedHours,
    };
  });
}
