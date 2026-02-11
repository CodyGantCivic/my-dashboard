import { useMemo, useCallback } from 'react';
import type { MetricsRecord, TimeScope, MetricsSummary, MetricsChartPoint } from '../types/metrics';
import { useLocalStorage } from './useLocalStorage';
import { summariseMetrics, toChartData } from '../utils/metricsCalc';

const STORAGE_KEY = 'wmp-metrics';

interface MetricsState {
  weekly: MetricsRecord[];
  monthly: MetricsRecord[];
}

export function useMetrics(scope: TimeScope) {
  const [state, setState] = useLocalStorage<MetricsState>(STORAGE_KEY, {
    weekly: [],
    monthly: [],
  });

  const records = useMemo(() => {
    if (scope === 'weekly') return state.weekly;
    if (scope === 'monthly') return state.monthly;
    // yearly: derive from monthly
    return state.monthly;
  }, [state, scope]);

  const summary: MetricsSummary = useMemo(() => summariseMetrics(records), [records]);
  const chartData: MetricsChartPoint[] = useMemo(() => toChartData(records), [records]);

  const updateRecord = useCallback(
    (id: string, patch: Partial<MetricsRecord>) => {
      setState((prev) => ({
        ...prev,
        weekly: prev.weekly.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        monthly: prev.monthly.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },
    [setState]
  );

  const addRecord = useCallback(
    (record: MetricsRecord) => {
      setState((prev) => {
        const key = record.scope === 'weekly' ? 'weekly' : 'monthly';
        return { ...prev, [key]: [...prev[key], record] };
      });
    },
    [setState]
  );

  return { records, summary, chartData, updateRecord, addRecord };
}
