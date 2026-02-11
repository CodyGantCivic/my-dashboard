// ── Time scope ────────────────────────────────────────
export type TimeScope = 'weekly' | 'monthly' | 'yearly';

// ── Setup tiers ───────────────────────────────────────
export type SetupTier = 'ultimate' | 'premium' | 'standard';

// ── A single metrics record for one period ────────────
export interface MetricsRecord {
  id: string;
  /** ISO date string for period start, e.g. "2026-02-03" */
  periodStart: string;
  scope: TimeScope;

  // Counts
  setups: Record<SetupTier, number>;
  revisions: number;
  launches: number;

  // Hours
  estimatedHours: number;
  actualHours: number;

  // Completion
  completedOnTime: boolean;
  completionPercentage: number; // 0–100
}

// ── Derived stats ─────────────────────────────────────
export interface MetricsSummary {
  totalSetups: number;
  setupsByTier: Record<SetupTier, number>;
  totalRevisions: number;
  totalLaunches: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  variance: number; // actual - estimated
  variancePercent: number;
  onTimeRate: number; // 0–100
  avgCompletionPercent: number;
}

// ── Chart data point ──────────────────────────────────
export interface MetricsChartPoint {
  label: string; // period label, e.g. "W6" or "Feb"
  setups: number;
  revisions: number;
  launches: number;
  estimated: number;
  actual: number;
  variance: number;
}
