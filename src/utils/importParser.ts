/**
 * Parse raw imported data from each source into TimeBlock arrays.
 *
 * Each source sends different shaped data via postMessage.
 * These parsers normalize everything into planner TimeBlocks.
 */
import type { TimeBlock, BlockType, Weekday } from '../types/planner';
import { WEEKDAYS, WORK_START_HOUR } from '../types/planner';
import { generateId, findAvailableSlot } from './plannerLogic';
import { startOfWeek, addDays, getDate, getMonth } from 'date-fns';

// ── Types for raw import data ────────────────────────────

export interface RawSalesforceRow {
  endDate: string;
  taskType: string;
  projectName: string;
  colorBlock: string;
  tag: string;
  setupNotes: string;
  ownerName?: string;
  /** Added by Wave Analytics extraction */
  taskId?: string;
  /** Added by Wave Analytics extraction */
  projectId?: string;
}

/** Legacy Cloud Coach format (generic table extraction) */
export interface RawCloudCoachTicket {
  projectName: string;
  description: string;
  estimatedHours: number;
  dueDate: string;
}

/** New Cloud Coach format (SLDS cc-sobject-table extraction) */
export interface RawCloudCoachRevision {
  name: string;
  project: string;
  projectHref?: string;
  description: string;
  hours: number;
  dueDate?: string;
  priority?: string;
  createdDate?: string;
  completed?: boolean;
  status?: string;
  revisionLabel?: string;
  webViewUrl?: string;
  assignees?: string[];
}

// ── Helper: dynamically map day-of-month to weekday ──────
// Computes which weekday a given day-of-month falls on for the current week.

function buildCurrentWeekDayMap(): Record<string, Weekday> {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const map: Record<string, Weekday> = {};
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i);
    // Key: "month-day" to handle month boundaries (e.g., Jan 31 → Feb 1 in same week)
    const key = `${getMonth(d)}-${getDate(d)}`;
    map[key] = WEEKDAYS[i];
  }
  return map;
}

function dayOfMonthToWeekday(dayOfMonth: number, month: number | null): Weekday | null {
  const map = buildCurrentWeekDayMap();
  if (month !== null) {
    return map[`${month}-${dayOfMonth}`] || null;
  }
  // If month not specified, try matching just the day across current week
  for (const [key, weekday] of Object.entries(map)) {
    if (key.endsWith(`-${dayOfMonth}`)) return weekday;
  }
  return null;
}

// ── Helper: detect tier from project name ────────────────

function detectTier(name: string): 'ultimate' | 'premium' | 'standard' {
  const lower = name.toLowerCase();
  if (lower.includes('ultimate')) return 'ultimate';
  if (lower.includes('migration premium') || lower.includes('premium')) return 'premium';
  return 'standard';
}

// ── Helper: extract short project name ───────────────────

function shortName(fullName: string): string {
  // "Chino Valley AZ | MWC Ultimate Redesign 1125" → "Chino Valley AZ"
  const parts = fullName.split('|');
  return parts[0].trim();
}

// ── Helper: parse a date/time tag string → { day, startHour, endHour } ──

function parseTag(tag: string): { day: Weekday; startHour: number; endHour: number } | null {
  if (!tag) return null;

  // Try to find a date like "2/10", "2/11", "February 11th"
  const monthDayMatch = tag.match(/(\d{1,2})\/(\d{1,2})/);
  const longDateMatch = tag.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i
  );

  let parsedMonth: number | null = null;
  let dayOfMonth: number | null = null;
  if (monthDayMatch) {
    parsedMonth = parseInt(monthDayMatch[1]) - 1; // 0-based month
    dayOfMonth = parseInt(monthDayMatch[2]);
  } else if (longDateMatch) {
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    parsedMonth = monthNames.indexOf(longDateMatch[1].toLowerCase());
    dayOfMonth = parseInt(longDateMatch[2]);
  }

  if (dayOfMonth === null) return null;

  // Dynamically map day of month to weekday for the current week
  const weekday = dayOfMonthToWeekday(dayOfMonth, parsedMonth);
  if (!weekday) return null;

  // Try to parse time range
  const timePatterns = [
    // "from 10:00am-11:00am"
    /(\d{1,2}):(\d{2})\s*(am|pm)\s*[-–to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)/i,
    // "from 10:30 am to 12 pm"
    /(\d{1,2}):?(\d{2})?\s*(am|pm)\s*(?:to|-|–)\s*(\d{1,2}):?(\d{2})?\s*(am|pm)/i,
    // "at 1 pm"
    /at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)/i,
  ];

  for (const pat of timePatterns) {
    const m = tag.match(pat);
    if (m) {
      if (m.length >= 7) {
        // Full range
        const startH = to24Hour(parseInt(m[1]), m[3]);
        const startM = parseInt(m[2] || '0');
        const endH = to24Hour(parseInt(m[4]), m[6]);
        const endM = parseInt(m[5] || '0');
        return {
          day: weekday,
          startHour: startH + startM / 60,
          endHour: endH + endM / 60,
        };
      } else if (m.length >= 4) {
        // Single time ("at 1 pm") — assume 1 hour duration
        const h = to24Hour(parseInt(m[1]), m[3]);
        const min = parseInt(m[2] || '0');
        return {
          day: weekday,
          startHour: h + min / 60,
          endHour: h + min / 60 + 1,
        };
      }
    }
  }

  return { day: weekday, startHour: 10, endHour: 11 }; // fallback
}

function to24Hour(hour: number, ampm: string): number {
  const isPM = ampm.toLowerCase() === 'pm';
  if (isPM && hour < 12) return hour + 12;
  if (!isPM && hour === 12) return 0;
  return hour;
}

// ── Helper: parse Outlook aria-label → meeting data ──────

interface ParsedEvent {
  title: string;
  day: Weekday;
  startHour: number;
  endHour: number;
  organizer: string;
  isLaunch: boolean;
}

function parseOutlookLabel(label: string): ParsedEvent | null {
  // Typical format from Outlook web aria-labels:
  // "Event Title, February 10, 2026, 10:00 AM, 10:30 AM, Organizer Name, Location"
  // Or: "Title, 10:00 AM - 10:30 AM, February 10, 2026"
  // The format varies, so we try multiple patterns.

  const parts = label.split(',').map((s) => s.trim());
  if (parts.length < 3) return null;

  // Find title (usually first part)
  const title = parts[0];

  // Find date — support any month, not just February
  let dayOfMonth: number | null = null;
  let parsedMonth: number | null = null;
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];

  for (const part of parts) {
    const dateMatch = part.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i
    );
    if (dateMatch) {
      const mName = dateMatch[1].toLowerCase();
      parsedMonth = monthNames.findIndex((m) => m.startsWith(mName.slice(0, 3)));
      dayOfMonth = parseInt(dateMatch[2]);
      break;
    }
  }

  if (dayOfMonth === null) return null;

  const weekday = dayOfMonthToWeekday(dayOfMonth, parsedMonth);
  if (!weekday) return null;

  // Find times
  let startHour = 9;
  let endHour = 10;
  const timeMatches: number[] = [];

  for (const part of parts) {
    const tMatch = part.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (tMatch) {
      const h = to24Hour(parseInt(tMatch[1]), tMatch[3]);
      const m = parseInt(tMatch[2]);
      timeMatches.push(h + m / 60);
    }
  }

  if (timeMatches.length >= 2) {
    startHour = timeMatches[0];
    endHour = timeMatches[1];
  } else if (timeMatches.length === 1) {
    startHour = timeMatches[0];
    endHour = startHour + 0.5;
  }

  // Find organizer (usually after times)
  const organizer = parts.length > 3 ? parts[parts.length - 1] : '';

  // Detect launches
  const isLaunch =
    title.toLowerCase().includes('launch') ||
    title.toLowerCase().includes('redesign launch');

  return { title, day: weekday, startHour, endHour, organizer, isLaunch };
}

// ── Main parsers ─────────────────────────────────────────

/** Parse Salesforce report rows into assignment + launch blocks. */
export function parseSalesforceData(rows: RawSalesforceRow[]): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  for (const row of rows) {
    const tier = detectTier(row.projectName);
    const name = shortName(row.projectName);

    if (row.taskType === 'Design Setup') {
      const hours = tier === 'ultimate' ? 8 : tier === 'premium' ? 6 : 3;
      // Place initial block — the auto-scheduler distributes across days later
      blocks.push({
        id: generateId(),
        type: `setup-${tier}` as BlockType,
        title: `${name} – ${tier.charAt(0).toUpperCase() + tier.slice(1)} Setup`,
        durationMinutes: Math.min(hours, 4) * 60, // max 4h block
        day: 'monday', // placeholder — scheduler distributes
        startHour: WORK_START_HOUR,
        sourceId: `sf-import-${row.projectName.slice(0, 20)}`,
      });

      // If > 4h, add continuation block
      if (hours > 4) {
        blocks.push({
          id: generateId(),
          type: `setup-${tier}` as BlockType,
          title: `${name} – ${tier.charAt(0).toUpperCase() + tier.slice(1)} Setup (cont.)`,
          durationMinutes: (hours - 4) * 60,
          day: 'tuesday', // placeholder
          startHour: WORK_START_HOUR,
          sourceId: `sf-import-${row.projectName.slice(0, 20)}-2`,
        });
      }
    }

    if (row.taskType === 'Website Launch') {
      const tagInfo = parseTag(row.tag);
      blocks.push({
        id: generateId(),
        type: 'launch',
        title: `${name} – Redesign Launch`,
        durationMinutes: tagInfo ? Math.round((tagInfo.endHour - tagInfo.startHour) * 60) : 60,
        day: tagInfo?.day || 'monday',
        startHour: tagInfo?.startHour || 10,
        locked: true,
        sourceId: `sf-import-launch-${name}`,
      });
    }
  }

  return blocks;
}

/** Parse Outlook calendar aria-labels into meeting/launch blocks. */
export function parseOutlookData(labels: string[]): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  for (const label of labels) {
    const parsed = parseOutlookLabel(label);
    if (!parsed) continue;

    const duration = Math.round((parsed.endHour - parsed.startHour) * 60);
    if (duration <= 0 || duration > 480) continue; // skip invalid

    blocks.push({
      id: generateId(),
      type: parsed.isLaunch ? 'launch' : 'meeting',
      title: parsed.title,
      durationMinutes: duration,
      day: parsed.day,
      startHour: parsed.startHour,
      locked: !parsed.isLaunch, // meetings are locked, launches can be adjusted
      sourceId: `cal-import-${parsed.title.slice(0, 20)}`,
    });
  }

  return blocks;
}

/**
 * Parse Cloud Coach data into revision blocks.
 * Handles both formats:
 * - New SLDS format: { name, project, hours, description, completed, ... }
 * - Legacy format: { projectName, estimatedHours, description, dueDate }
 */
export function parseCloudCoachData(tickets: (RawCloudCoachTicket | RawCloudCoachRevision)[]): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let dayIdx = 0;

  for (const ticket of tickets) {
    // Detect format: new SLDS format has 'name' + 'project', legacy has 'projectName'
    const isNewFormat = 'name' in ticket && 'project' in ticket;

    if (isNewFormat) {
      const rev = ticket as RawCloudCoachRevision;

      // Skip completed revisions
      if (rev.completed) continue;

      const hours = rev.hours || 1;
      const projectName = rev.project || rev.name;
      const revLabel = rev.revisionLabel || rev.name;

      // Try to parse due date for day placement
      let targetDay: Weekday = WEEKDAYS[dayIdx % 5];
      if (rev.dueDate) {
        const dueDateMatch = rev.dueDate.match(/(\d{1,2})\/(\d{1,2})/);
        if (dueDateMatch) {
          const month = parseInt(dueDateMatch[1]) - 1; // 0-based
          const day = parseInt(dueDateMatch[2]);
          const weekday = dayOfMonthToWeekday(day, month);
          if (weekday) targetDay = weekday;
        }
      }

      blocks.push({
        id: generateId(),
        type: 'revision',
        title: `${shortName(projectName)} – ${revLabel}`,
        durationMinutes: Math.round(hours * 60),
        day: targetDay,
        startHour: 15, // afternoon placeholder
        sourceId: `tk-import-${projectName.slice(0, 20)}`,
      });
    } else {
      // Legacy format
      const leg = ticket as RawCloudCoachTicket;
      const hours = leg.estimatedHours || 1;

      blocks.push({
        id: generateId(),
        type: 'revision',
        title: `${leg.projectName} – Revision`,
        durationMinutes: Math.round(hours * 60),
        day: WEEKDAYS[dayIdx % 5],
        startHour: 15, // afternoon placeholder
        sourceId: `tk-import-${leg.projectName.slice(0, 20)}`,
      });
    }

    dayIdx++;
  }

  return blocks;
}

// ── Merge all sources into a full week plan ──────────────

/** De-duplicate launches (prefer Outlook timing over Salesforce tag parsing). */
function deduplicateLaunches(
  sfBlocks: TimeBlock[],
  calBlocks: TimeBlock[]
): TimeBlock[] {
  const calLaunches = calBlocks.filter((b) => b.type === 'launch');
  const sfLaunches = sfBlocks.filter((b) => b.type === 'launch');
  const sfNonLaunches = sfBlocks.filter((b) => b.type !== 'launch');

  // For each SF launch, check if there's a matching calendar launch
  const dedupedSfLaunches: TimeBlock[] = [];
  for (const sfL of sfLaunches) {
    const sfName = sfL.title.toLowerCase();
    const hasCalMatch = calLaunches.some((calL) => {
      const calName = calL.title.toLowerCase();
      // Match by city name overlap
      const sfWords = sfName.split(/[\s–-]+/);
      return sfWords.some((w) => w.length > 3 && calName.includes(w));
    });

    if (!hasCalMatch) {
      // No calendar match — keep SF version
      dedupedSfLaunches.push(sfL);
    }
    // Otherwise, calendar version wins (has better time data)
  }

  return [...sfNonLaunches, ...dedupedSfLaunches];
}

/** Add lunch breaks and admin buffers to a set of blocks. */
function addDefaults(blocks: TimeBlock[]): TimeBlock[] {
  const defaults: TimeBlock[] = [];

  for (const day of WEEKDAYS) {
    // Lunch break at noon
    defaults.push({
      id: generateId(),
      type: 'break',
      title: 'Lunch Break',
      durationMinutes: 30,
      day,
      startHour: 12,
    });

    // Daily admin buffer
    defaults.push({
      id: generateId(),
      type: 'buffer',
      title: 'Daily Admin',
      durationMinutes: 15,
      day,
      startHour: 16.5,
    });
  }

  return [...blocks, ...defaults];
}

/** Auto-schedule blocks: distribute setup blocks across available days. */
function autoScheduleSetups(blocks: TimeBlock[]): TimeBlock[] {
  const setups = blocks.filter((b) => b.type.startsWith('setup-'));
  const others = blocks.filter((b) => !b.type.startsWith('setup-'));

  // Track used slots per day
  const scheduled: TimeBlock[] = [...others];

  for (const setup of setups) {
    // Find the best day with available time
    let placed = false;
    for (const day of WEEKDAYS) {
      const slot = findAvailableSlot(
        scheduled.filter((b) => b.day === day),
        day,
        setup.durationMinutes
      );
      if (slot !== null) {
        scheduled.push({ ...setup, day, startHour: slot });
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Put it on the first available day at 8 AM as overflow
      scheduled.push({ ...setup, day: WEEKDAYS[0], startHour: 8 });
    }
  }

  return scheduled;
}

/** Main merge: combine all imported blocks into a final plan. */
export function mergeImportedData(
  sfBlocks: TimeBlock[],
  calBlocks: TimeBlock[],
  ccBlocks: TimeBlock[]
): TimeBlock[] {
  // 1. De-duplicate launches (calendar wins)
  const sfDeduped = deduplicateLaunches(sfBlocks, calBlocks);

  // 2. Combine
  let allBlocks = [...sfDeduped, ...calBlocks, ...ccBlocks];

  // 3. Add lunch breaks + admin buffers
  allBlocks = addDefaults(allBlocks);

  // 4. Auto-schedule setup blocks into available slots
  allBlocks = autoScheduleSetups(allBlocks);

  return allBlocks;
}
