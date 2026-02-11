import type { TimeBlock, WeeklyPlan } from '../types/planner';

/**
 * Current week's planner blocks — Feb 9–13, 2026.
 * Built from real Salesforce assignments, Cloud Coach tickets, and Outlook calendar.
 *
 * Hour estimates:
 *   Ultimate Setup = 8 hours
 *   Premium Setup  = 6 hours
 *   Standard Setup = 3 hours
 *   Launch         = actual calendar duration
 *   Revision       = from ticket description
 *   Break          = 30 min daily lunch
 */
const mockBlocks: TimeBlock[] = [
  // ── Monday (Feb 9) ────────────────────
  // Setups: work on Chino Valley AZ Ultimate (part 1)
  { id: 'b-mon-1', type: 'setup-ultimate', title: 'Chino Valley AZ – Ultimate Setup', durationMinutes: 120, day: 'monday', startHour: 8, sourceId: 'sf-2' },
  // Meetings: Weekly Commitments + WebDev Huddle
  { id: 'b-mon-2', type: 'meeting', title: 'Weekly Commitments and Goal Review', durationMinutes: 30, day: 'monday', startHour: 10, locked: true, sourceId: 'cal-1' },
  { id: 'b-mon-3', type: 'meeting', title: 'WebDev Huddle', durationMinutes: 30, day: 'monday', startHour: 10.5, locked: true, sourceId: 'cal-2' },
  // Continue Chino Valley setup
  { id: 'b-mon-4', type: 'setup-ultimate', title: 'Chino Valley AZ – Ultimate Setup (cont.)', durationMinutes: 90, day: 'monday', startHour: 11, sourceId: 'sf-2' },
  // Lunch
  { id: 'b-mon-5', type: 'break', title: 'Lunch Break', durationMinutes: 30, day: 'monday', startHour: 12.5 },
  // Overdue revisions: OH-Lorain County + Sanford NC
  { id: 'b-mon-6', type: 'revision', title: 'OH-Lorain County – Revision (overdue)', durationMinutes: 60, day: 'monday', startHour: 13, sourceId: 'tk-6' },
  // Site Review meeting
  { id: 'b-mon-7', type: 'meeting', title: 'Site Review', durationMinutes: 25, day: 'monday', startHour: 14.5, locked: true, sourceId: 'cal-3' },
  // Sanford NC revision
  { id: 'b-mon-8', type: 'revision', title: 'Sanford, NC – Revision (overdue)', durationMinutes: 60, day: 'monday', startHour: 15, sourceId: 'tk-7' },
  // Buffer
  { id: 'b-mon-9', type: 'buffer', title: 'Daily Admin', durationMinutes: 30, day: 'monday', startHour: 16 },

  // ── Tuesday (Feb 10) ──────────────────
  // Continue Chino Valley setup
  { id: 'b-tue-1', type: 'setup-ultimate', title: 'Chino Valley AZ – Ultimate Setup (cont.)', durationMinutes: 120, day: 'tuesday', startHour: 8, sourceId: 'sf-2' },
  // Launch: Saratoga Springs UT
  { id: 'b-tue-2', type: 'launch', title: 'Saratoga Springs UT – Redesign Launch', durationMinutes: 60, day: 'tuesday', startHour: 10, locked: true, sourceId: 'cal-4' },
  // Rock Hall MD Premium Setup (start)
  { id: 'b-tue-3', type: 'setup-premium', title: 'Rock Hall MD – Premium Setup', durationMinutes: 90, day: 'tuesday', startHour: 11, sourceId: 'sf-1' },
  // Lunch
  { id: 'b-tue-4', type: 'break', title: 'Lunch Break', durationMinutes: 30, day: 'tuesday', startHour: 12.5 },
  // Continue Rock Hall
  { id: 'b-tue-5', type: 'setup-premium', title: 'Rock Hall MD – Premium Setup (cont.)', durationMinutes: 120, day: 'tuesday', startHour: 13, sourceId: 'sf-1' },
  // Overdue revisions
  { id: 'b-tue-6', type: 'revision', title: 'NY-Ithaca R4 – Revision (overdue)', durationMinutes: 60, day: 'tuesday', startHour: 15, sourceId: 'tk-8' },
  // Buffer
  { id: 'b-tue-7', type: 'buffer', title: 'Daily Admin', durationMinutes: 30, day: 'tuesday', startHour: 16 },

  // ── Wednesday (Feb 11) ─────────────────
  // Louisa County VA Ultimate Setup (start)
  { id: 'b-wed-1', type: 'setup-ultimate', title: 'Louisa County VA – Ultimate Setup', durationMinutes: 150, day: 'wednesday', startHour: 8, sourceId: 'sf-3' },
  // Launch: Chaska MN (reminder only)
  { id: 'b-wed-2', type: 'launch', title: 'Chaska MN – Redesign Launch + 1 Standard DHP', durationMinutes: 90, day: 'wednesday', startHour: 10.5, sourceId: 'cal-5' },
  // Lunch
  { id: 'b-wed-3', type: 'break', title: 'Lunch Break', durationMinutes: 30, day: 'wednesday', startHour: 12 },
  // Launch: New Rochelle NY
  { id: 'b-wed-4', type: 'launch', title: 'New Rochelle, NY – Redesign Launch', durationMinutes: 180, day: 'wednesday', startHour: 13, locked: true, sourceId: 'cal-6' },
  // Revision: San Leandro CA
  { id: 'b-wed-5', type: 'revision', title: 'San Leandro CA – Revision', durationMinutes: 30, day: 'wednesday', startHour: 16, sourceId: 'tk-5' },
  // Buffer
  { id: 'b-wed-6', type: 'buffer', title: 'Daily Admin', durationMinutes: 30, day: 'wednesday', startHour: 16.5 },

  // ── Thursday (Feb 12) ──────────────────
  // Continue Louisa County setup
  { id: 'b-thu-1', type: 'setup-ultimate', title: 'Louisa County VA – Ultimate Setup (cont.)', durationMinutes: 240, day: 'thursday', startHour: 8, sourceId: 'sf-3' },
  // Launch: Boca Raton FL (reminder only)
  { id: 'b-thu-2', type: 'launch', title: 'Boca Raton FL – Redesign Launch', durationMinutes: 180, day: 'thursday', startHour: 12, sourceId: 'cal-7' },
  // Meeting: AI Learning Series Office Hours
  { id: 'b-thu-3', type: 'meeting', title: 'AI Learning Series Office Hours', durationMinutes: 60, day: 'thursday', startHour: 15.5, locked: true, sourceId: 'cal-8' },
  // Buffer
  { id: 'b-thu-4', type: 'buffer', title: 'Daily Admin', durationMinutes: 30, day: 'thursday', startHour: 16.5 },

  // ── Friday (Feb 13) ────────────────────
  // Continue Rock Hall Premium Setup
  { id: 'b-fri-1', type: 'setup-premium', title: 'Rock Hall MD – Premium Setup (cont.)', durationMinutes: 120, day: 'friday', startHour: 8, sourceId: 'sf-1' },
  // Meeting: Implementation Teams Standup (skipping since it's only 15 min — still show)
  // Revisions: Crest Hill, Bel Aire, Aspen, Palmetto Bay
  { id: 'b-fri-2', type: 'revision', title: 'IL-Crest Hill – Revision', durationMinutes: 60, day: 'friday', startHour: 10, sourceId: 'tk-1' },
  // Meeting: Designers Unite
  { id: 'b-fri-3', type: 'meeting', title: 'Designers Unite Meeting [DUM]', durationMinutes: 25, day: 'friday', startHour: 11, locked: true, sourceId: 'cal-10' },
  // Lunch
  { id: 'b-fri-4', type: 'break', title: 'Lunch Break', durationMinutes: 30, day: 'friday', startHour: 11.5 },
  // More revisions
  { id: 'b-fri-5', type: 'revision', title: 'Bel Aire, KS – Revision', durationMinutes: 120, day: 'friday', startHour: 12, sourceId: 'tk-2' },
  // Meeting: Review Past Due Task Reports
  { id: 'b-fri-6', type: 'meeting', title: 'Review Past Due Task Reports', durationMinutes: 25, day: 'friday', startHour: 14, locked: true, sourceId: 'cal-11' },
  // Quick revisions
  { id: 'b-fri-7', type: 'revision', title: 'Palmetto Bay Village – Revision', durationMinutes: 15, day: 'friday', startHour: 14.5, sourceId: 'tk-4' },
  // Comp Completions (reminder)
  { id: 'b-fri-8', type: 'meeting', title: 'Comp Completions Due', durationMinutes: 30, day: 'friday', startHour: 15, sourceId: 'cal-12' },
  // Buffer
  { id: 'b-fri-9', type: 'buffer', title: 'Daily Admin', durationMinutes: 30, day: 'friday', startHour: 15.5 },
];

export const mockWeeklyPlan: WeeklyPlan = {
  id: 'plan-2026-w07',
  weekStart: '2026-02-09',
  blocks: mockBlocks,
};
