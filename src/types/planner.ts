// ── Block types ───────────────────────────────────────
export type BlockType =
  | 'setup-ultimate'
  | 'setup-premium'
  | 'setup-standard'
  | 'revision'
  | 'launch'
  | 'meeting'
  | 'buffer'
  | 'break';

// ── Day of week (workdays only) ───────────────────────
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
};

// ── Work hours (8-hour day: 8am–5pm) ──────────────────
export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 17;
export const HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR; // 9 slots but 8h of real work + 1h for gaps

// ── Setup hour estimates (actual hours per tier) ─────
export const SETUP_HOURS: Record<'ultimate' | 'premium' | 'standard', number> = {
  ultimate: 8,
  premium: 6,
  standard: 3,
};

export const LAUNCH_HOURS = 0.5; // 30 min default for launches
export const REVISION_DEFAULT_HOURS = 1; // 1 hour default for revisions
export const BREAK_MINUTES = 30; // 30 min daily lunch break

// ── A single time block on the planner ────────────────
export interface TimeBlock {
  id: string;
  type: BlockType;
  title: string;
  /** Duration in minutes (must be multiple of 30) */
  durationMinutes: number;
  day: Weekday;
  /** Start hour in 24h format, e.g. 8, 8.5, 9 */
  startHour: number;
  /** Optional: source task ID from Salesforce */
  sourceId?: string;
  /** If true, block cannot be moved (e.g. meetings) */
  locked?: boolean;
}

// ── Weekly plan ───────────────────────────────────────
export interface WeeklyPlan {
  id: string;
  /** ISO date of week start (Monday) */
  weekStart: string;
  blocks: TimeBlock[];
}

// ── Capacity summary ──────────────────────────────────
export interface CapacitySummary {
  totalAvailableMinutes: number; // 40h = 2400 min
  totalScheduledMinutes: number;
  totalBreakMinutes: number;
  totalBufferMinutes: number;
  totalWorkMinutes: number; // scheduled - breaks - buffer
  remainingMinutes: number;
  utilizationPercent: number;
  status: 'under' | 'balanced' | 'over';
}

// ── Block colour map (muted, natural palette) ───────
export const BLOCK_COLORS: Record<BlockType, string> = {
  'setup-ultimate': '#6d5acd',  // soft indigo
  'setup-premium': '#5b8bd4',   // calm blue
  'setup-standard': '#6aabb7',  // dusty teal
  revision: '#c8944a',          // warm amber
  launch: '#5aa87a',            // sage green
  meeting: '#c25d5d',           // muted rose
  buffer: '#8e99a4',            // cool slate
  break: '#d4dae0',             // light fog
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  'setup-ultimate': 'Setup (Ultimate)',
  'setup-premium': 'Setup (Premium)',
  'setup-standard': 'Setup (Standard)',
  revision: 'Revision',
  launch: 'Launch',
  meeting: 'Meeting',
  buffer: 'Buffer',
  break: 'Break',
};
