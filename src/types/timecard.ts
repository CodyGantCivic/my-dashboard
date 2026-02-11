import type { Weekday } from './planner';

// ── Cloud Coach timecard categories ─────────────────
export type AdminCategory =
  | 'internal-meeting'
  | 'non-exempt-breaks'
  | 'daily-admin'
  | 'employee-development'
  | 'approved-internal-project'
  | 'onboarding'
  | 'time-off'
  | 'time-off-company-holiday';

export const ADMIN_LABELS: Record<AdminCategory, string> = {
  'internal-meeting': 'Internal Meeting',
  'non-exempt-breaks': 'Non-Exempt Breaks',
  'daily-admin': 'Daily Admin',
  'employee-development': 'Employee Development',
  'approved-internal-project': 'Approved Internal Project',
  onboarding: 'Onboarding',
  'time-off': 'Time Off',
  'time-off-company-holiday': 'Time Off - Company Holiday',
};

// Commonly used admin categories (shown by default)
export const DEFAULT_ADMIN_CATEGORIES: AdminCategory[] = [
  'internal-meeting',
  'non-exempt-breaks',
  'daily-admin',
];

// ── A single timecard entry ─────────────────────────
export interface TimecardEntry {
  id: string;
  /** 'admin' for admin categories, 'assignment' for project tasks */
  section: 'admin' | 'assignment';
  /** Admin category or project task identifier */
  category: AdminCategory | string;
  /** Display label */
  label: string;
  /** Hours logged (decimal, e.g. 1.5 for 1h 30m) */
  hours: number;
  /** Optional comment */
  comment: string;
  /** Day of week */
  day: Weekday;
  /** Optional: project name for assignment entries */
  projectName?: string;
  /** Optional: task type (Design Setup, Website Launch, etc.) */
  taskType?: string;
}

// ── Day summary for the sidebar ─────────────────────
export interface DaySummary {
  day: Weekday;
  totalHours: number;
  adminHours: number;
  assignmentHours: number;
}

// ── Full weekly timecard ────────────────────────────
export interface WeeklyTimecard {
  id: string;
  weekStart: string; // ISO date
  entries: TimecardEntry[];
}

// ── Format hours as H:MM for Cloud Coach ────────────
export function formatTimecardHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}
