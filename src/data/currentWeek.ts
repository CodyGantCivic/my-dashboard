/**
 * Current week data — Feb 9–13, 2026
 * Combines data from:
 *   Source 1: Salesforce Resource Assignments report (setups + launches)
 *   Source 2: Cloud Coach Tickets (revisions)
 *   Source 3: Outlook Calendar (meetings + launch times)
 */
import type { TimeBlock, WeeklyPlan } from '../types/planner';

// ── Projects this week (from Salesforce) ─────────────
export interface ProjectAssignment {
  id: string;
  projectName: string;
  fullProjectName: string; // e.g. "Chino Valley AZ | MWC Ultimate Redesign 1125"
  taskType: 'Design Setup' | 'Website Launch';
  tier: 'ultimate' | 'premium' | 'standard';
  endDate: string;
  colorBlock: string;
  tag: string;
  ownerName: string;
}

export const thisWeekAssignments: ProjectAssignment[] = [
  {
    id: 'sf-1',
    projectName: 'Rock Hall MD',
    fullProjectName: 'Rock Hall MD | MWC Migration Premium',
    taskType: 'Design Setup',
    tier: 'premium',
    endDate: '2/13/2026',
    colorBlock: 'Green',
    tag: '',
    ownerName: '',
  },
  {
    id: 'sf-2',
    projectName: 'Chino Valley AZ',
    fullProjectName: 'Chino Valley AZ | MWC Ultimate Redesign 1125',
    taskType: 'Design Setup',
    tier: 'ultimate',
    endDate: '2/13/2026',
    colorBlock: 'Green',
    tag: '',
    ownerName: '',
  },
  {
    id: 'sf-3',
    projectName: 'Louisa County VA',
    fullProjectName: 'Louisa County VA | MWC Ultimate Redesign 1125',
    taskType: 'Design Setup',
    tier: 'ultimate',
    endDate: '2/13/2026',
    colorBlock: 'Green',
    tag: '',
    ownerName: '',
  },
  {
    id: 'sf-4',
    projectName: 'Saratoga Springs UT',
    fullProjectName: 'Saratoga Springs UT | MWC Ultimate Redesign 0425',
    taskType: 'Website Launch',
    tier: 'ultimate',
    endDate: '2/10/2026',
    colorBlock: 'Green',
    tag: 'Website Launch scheduled for 2/10 from 10:00am-11:00am (CST)',
    ownerName: 'Justin Blecha',
  },
  {
    id: 'sf-5',
    projectName: 'Chaska MN',
    fullProjectName: 'Chaska MN | CivicEngage Ultimate Redesign 0125',
    taskType: 'Website Launch',
    tier: 'ultimate',
    endDate: '2/11/2026',
    colorBlock: 'Green',
    tag: 'February 11th from 10:30 am to 12 pm CST',
    ownerName: 'Liliana Castro',
  },
  {
    id: 'sf-6',
    projectName: 'New Rochelle NY',
    fullProjectName: 'New Rochelle NY | MWC Ultimate Redesign 0625',
    taskType: 'Website Launch',
    tier: 'ultimate',
    endDate: '2/11/2026',
    colorBlock: 'Green',
    tag: '2/11 at 1 pm central',
    ownerName: 'Colby Torrez',
  },
  {
    id: 'sf-7',
    projectName: 'Boca Raton FL',
    fullProjectName: 'Boca Raton FL | MWC Ultimate Redesign 0525',
    taskType: 'Website Launch',
    tier: 'ultimate',
    endDate: '2/12/2026',
    colorBlock: 'Green',
    tag: '2/12 at 1 pm est',
    ownerName: 'Briana Reardon',
  },
];

// ── Revision tickets this week (from Cloud Coach Tickets) ──
export interface RevisionTicket {
  id: string;
  projectName: string;
  description: string;
  estimatedHours: number;
  dueDate: string;
  isOverdue: boolean;
}

export const thisWeekRevisions: RevisionTicket[] = [
  { id: 'tk-1', projectName: 'IL-Crest Hill', description: 'Design Revisions', estimatedHours: 1, dueDate: '2/13/2026', isOverdue: false },
  { id: 'tk-2', projectName: 'Bel Aire, KS', description: 'Design Revisions', estimatedHours: 2, dueDate: '2/13/2026', isOverdue: false },
  { id: 'tk-3', projectName: 'CO-Aspen/Pitkin County', description: 'Design Revisions', estimatedHours: 2, dueDate: '2/13/2026', isOverdue: false },
  { id: 'tk-4', projectName: 'Palmetto Bay Village', description: 'Design Revisions', estimatedHours: 0.25, dueDate: '2/13/2026', isOverdue: false },
  { id: 'tk-5', projectName: 'San Leandro CA', description: 'Design Revisions', estimatedHours: 0.5, dueDate: '2/11/2026', isOverdue: false },
  { id: 'tk-6', projectName: 'OH-Lorain County', description: 'Design Revisions', estimatedHours: 1, dueDate: '2/9/2026', isOverdue: true },
  { id: 'tk-7', projectName: 'Sanford, NC', description: 'Design Revisions', estimatedHours: 1, dueDate: '2/9/2026', isOverdue: true },
  { id: 'tk-8', projectName: 'NY-Ithaca R4', description: 'Design Revisions', estimatedHours: 1, dueDate: '2/5/2026', isOverdue: true },
  { id: 'tk-9', projectName: 'TN-Pigeon Forge', description: 'Design Revisions', estimatedHours: 1.5, dueDate: '2/3/2026', isOverdue: true },
  { id: 'tk-10', projectName: 'FL-Boca Raton Library', description: 'Design Revisions', estimatedHours: 1, dueDate: '1/29/2026', isOverdue: true },
];

// ── Meetings this week (from Outlook Calendar) ──────────
export interface CalendarMeeting {
  id: string;
  title: string;
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  startHour: number;
  endHour: number;
  organizer: string;
  isRecurring: boolean;
  isCancelled: boolean;
  isReminderOnly: boolean;
  isLaunch: boolean;
}

export const thisWeekMeetings: CalendarMeeting[] = [
  // Monday
  { id: 'cal-1', title: 'Weekly Commitments and Goal Review', day: 'monday', startHour: 10, endHour: 10.5, organizer: 'Rachel Butts', isRecurring: true, isCancelled: false, isReminderOnly: false, isLaunch: false },
  { id: 'cal-2', title: 'WebDev Huddle', day: 'monday', startHour: 10.5, endHour: 11, organizer: 'Ella Henton', isRecurring: true, isCancelled: false, isReminderOnly: false, isLaunch: false },
  { id: 'cal-3', title: 'Site Review', day: 'monday', startHour: 14.5, endHour: 14.917, organizer: 'Rachel Butts', isRecurring: true, isCancelled: false, isReminderOnly: false, isLaunch: false },

  // Tuesday
  { id: 'cal-4', title: 'Saratoga Springs UT - Redesign Launch', day: 'tuesday', startHour: 10, endHour: 11, organizer: 'Justin Blecha', isRecurring: false, isCancelled: false, isReminderOnly: false, isLaunch: true },

  // Wednesday
  { id: 'cal-5', title: 'Redesign Launch: Chaska MN + 1 Standard DHP', day: 'wednesday', startHour: 10.5, endHour: 12, organizer: 'Liliana Castro', isRecurring: false, isCancelled: false, isReminderOnly: true, isLaunch: true },
  { id: 'cal-6', title: 'Redesign Launch – New Rochelle, NY', day: 'wednesday', startHour: 13, endHour: 16, organizer: 'Colby Torrez', isRecurring: false, isCancelled: false, isReminderOnly: false, isLaunch: true },

  // Thursday
  { id: 'cal-7', title: 'Redesign Launch – Boca Raton, FL', day: 'thursday', startHour: 12, endHour: 15, organizer: 'Briana Reardon', isRecurring: false, isCancelled: false, isReminderOnly: true, isLaunch: true },
  { id: 'cal-8', title: 'AI Learning Series Office Hours', day: 'thursday', startHour: 15.5, endHour: 16.5, organizer: 'CP Meetings And Events', isRecurring: true, isCancelled: false, isReminderOnly: false, isLaunch: false },

  // Friday
  { id: 'cal-9', title: 'Implementation Teams Standup', day: 'friday', startHour: 9, endHour: 9.25, organizer: 'Rachel Butts', isRecurring: true, isCancelled: false, isReminderOnly: false, isLaunch: false },
  { id: 'cal-10', title: 'Designers Unite Meeting [DUM]', day: 'friday', startHour: 11, endHour: 11.417, organizer: 'Rachel Butts', isRecurring: true, isCancelled: false, isReminderOnly: false, isLaunch: false },
  { id: 'cal-11', title: 'Review Past Due Task Reports', day: 'friday', startHour: 14, endHour: 14.417, organizer: 'Rachel Butts', isRecurring: true, isCancelled: false, isReminderOnly: false, isLaunch: false },
  { id: 'cal-12', title: 'Comp Completions Due', day: 'friday', startHour: 15, endHour: 15.5, organizer: 'Rachel Davis', isRecurring: true, isCancelled: false, isReminderOnly: true, isLaunch: false },
];

// ── Build planner blocks from real data ─────────────────
function buildBlocks(): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let idx = 0;
  const id = () => `rw-${++idx}`;

  // 1. Add meetings (locked, fixed times)
  for (const mtg of thisWeekMeetings) {
    if (mtg.isCancelled) continue;
    const durationMinutes = Math.round((mtg.endHour - mtg.startHour) * 60);
    blocks.push({
      id: id(),
      type: mtg.isLaunch ? 'launch' : 'meeting',
      title: mtg.title,
      durationMinutes,
      day: mtg.day,
      startHour: mtg.startHour,
      locked: !mtg.isReminderOnly,
      sourceId: mtg.id,
    });
  }

  // 2. Add lunch breaks (30 min daily)
  const weekdays: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'> = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  ];
  for (const day of weekdays) {
    blocks.push({
      id: id(),
      type: 'break',
      title: 'Lunch Break',
      durationMinutes: 30,
      day,
      startHour: 12, // default noon, will overlap on some days — user can adjust
    });
  }

  // 3. Add design setups (placed in available gaps)
  // Distribute setups across the week - each takes significant time
  const setupPlacements: Array<{
    assignment: ProjectAssignment;
    day: typeof weekdays[number];
    startHour: number;
  }> = [
    { assignment: thisWeekAssignments[1], day: 'monday', startHour: 8 },     // Chino Valley AZ (Ultimate 8h) - Mon+Tue split
    { assignment: thisWeekAssignments[2], day: 'wednesday', startHour: 8 },   // Louisa County VA (Ultimate 8h) - Wed (partial)
    { assignment: thisWeekAssignments[0], day: 'thursday', startHour: 8 },    // Rock Hall MD (Premium 6h) - Thu
    // Continued work on sites fills remaining time
  ];

  for (const sp of setupPlacements) {
    const tierHours = sp.assignment.tier === 'ultimate' ? 8 : sp.assignment.tier === 'premium' ? 6 : 3;
    // Place as large a block as fits (max 4h per block for readability)
    const blockHours = Math.min(tierHours, 4);
    blocks.push({
      id: id(),
      type: `setup-${sp.assignment.tier}` as TimeBlock['type'],
      title: `${sp.assignment.projectName} – ${sp.assignment.tier.charAt(0).toUpperCase() + sp.assignment.tier.slice(1)} Setup`,
      durationMinutes: blockHours * 60,
      day: sp.day,
      startHour: sp.startHour,
      sourceId: sp.assignment.id,
    });
  }

  // 4. Add revision blocks for pending + overdue tickets
  // Place overdue first, then by due date
  const sortedRevisions = [...thisWeekRevisions].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  // Place revisions in available slots across the week
  const revisionDays: typeof weekdays[number][] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  let dayIdx = 0;
  for (const rev of sortedRevisions.slice(0, 6)) { // Fit top 6 revisions this week
    blocks.push({
      id: id(),
      type: 'revision',
      title: `${rev.projectName} – Revision`,
      durationMinutes: Math.round(rev.estimatedHours * 60),
      day: revisionDays[dayIdx % 5],
      startHour: 15, // afternoon - will need user adjustment
      sourceId: rev.id,
    });
    dayIdx++;
  }

  // 5. Add daily admin buffer (15 min per day)
  for (const day of weekdays) {
    blocks.push({
      id: id(),
      type: 'buffer',
      title: 'Daily Admin',
      durationMinutes: 15,
      day,
      startHour: 16.5,
    });
  }

  return blocks;
}

export const realWeekBlocks = buildBlocks();

export const realWeeklyPlan: WeeklyPlan = {
  id: 'plan-2026-w07',
  weekStart: '2026-02-09',
  blocks: realWeekBlocks,
};

// ── Weekly summary stats ────────────────────────────────
export const weekSummary = {
  setups: {
    ultimate: thisWeekAssignments.filter(a => a.taskType === 'Design Setup' && a.tier === 'ultimate').length,
    premium: thisWeekAssignments.filter(a => a.taskType === 'Design Setup' && a.tier === 'premium').length,
    standard: thisWeekAssignments.filter(a => a.taskType === 'Design Setup' && a.tier === 'standard').length,
  },
  launches: thisWeekAssignments.filter(a => a.taskType === 'Website Launch').length,
  revisions: thisWeekRevisions.length,
  totalRevisionHours: thisWeekRevisions.reduce((sum, r) => sum + r.estimatedHours, 0),
  overdueRevisions: thisWeekRevisions.filter(r => r.isOverdue).length,
};
