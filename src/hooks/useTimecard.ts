import { useMemo, useCallback } from 'react';
import type { WeeklyTimecard, TimecardEntry, DaySummary } from '../types/timecard';
import type { Weekday, TimeBlock } from '../types/planner';
import { WEEKDAYS } from '../types/planner';
import { useLocalStorage } from './useLocalStorage';
import { startOfWeek, format } from 'date-fns';

const STORAGE_KEY = 'wmp-timecard';

/** Build timecard entries from planner blocks. */
function buildEntriesFromBlocks(plannerBlocks: TimeBlock[]): TimecardEntry[] {
  const entries: TimecardEntry[] = [];
  let idx = 0;
  const id = () => `tc-${++idx}`;

  for (const day of WEEKDAYS) {
    // ── Admin entries derived from planner blocks ──────────
    const meetingBlocks = plannerBlocks.filter(
      (b) => b.day === day && b.type === 'meeting'
    );
    const meetingHours = meetingBlocks.reduce(
      (sum, b) => sum + b.durationMinutes / 60, 0
    );
    if (meetingHours > 0) {
      entries.push({
        id: id(),
        section: 'admin',
        category: 'internal-meeting',
        label: 'Internal Meeting',
        hours: Math.round(meetingHours * 100) / 100,
        comment: meetingBlocks.map((b) => b.title).join(', '),
        day,
      });
    }

    // Break blocks
    const breakBlocks = plannerBlocks.filter(
      (b) => b.day === day && b.type === 'break'
    );
    const breakHours = breakBlocks.reduce(
      (sum, b) => sum + b.durationMinutes / 60, 0
    );
    if (breakHours > 0) {
      entries.push({
        id: id(),
        section: 'admin',
        category: 'non-exempt-breaks',
        label: 'Non-Exempt Breaks',
        hours: Math.round(breakHours * 100) / 100,
        comment: 'Break',
        day,
      });
    }

    // Buffer/admin blocks
    const adminBlocks = plannerBlocks.filter(
      (b) => b.day === day && b.type === 'buffer'
    );
    const adminHrs = adminBlocks.reduce(
      (sum, b) => sum + b.durationMinutes / 60, 0
    );
    if (adminHrs > 0) {
      entries.push({
        id: id(),
        section: 'admin',
        category: 'daily-admin',
        label: 'Daily Admin',
        hours: Math.round(adminHrs * 100) / 100,
        comment: '',
        day,
      });
    }

    // ── Assignment entries from planner blocks ──────────
    // Setups (setup-ultimate, setup-premium, setup-standard)
    const setupBlocks = plannerBlocks.filter(
      (b) => b.day === day && b.type.startsWith('setup-')
    );
    for (const block of setupBlocks) {
      entries.push({
        id: id(),
        section: 'assignment',
        category: `setup-${block.id}`,
        label: `(${block.title}) Design Setup`,
        hours: Math.round((block.durationMinutes / 60) * 100) / 100,
        comment: '',
        day,
        projectName: block.title,
        taskType: 'Design Setup',
      });
    }

    // Launches
    const launchBlocks = plannerBlocks.filter(
      (b) => b.day === day && b.type === 'launch'
    );
    for (const block of launchBlocks) {
      entries.push({
        id: id(),
        section: 'assignment',
        category: `launch-${block.id}`,
        label: `(${block.title}) Website Launch`,
        hours: Math.round((block.durationMinutes / 60) * 100) / 100,
        comment: '',
        day,
        projectName: block.title,
        taskType: 'Website Launch',
      });
    }

    // Revisions
    const revisionBlocks = plannerBlocks.filter(
      (b) => b.day === day && b.type === 'revision'
    );
    for (const block of revisionBlocks) {
      entries.push({
        id: id(),
        section: 'assignment',
        category: `revision-${block.id}`,
        label: `${block.title} – Revision`,
        hours: Math.round((block.durationMinutes / 60) * 100) / 100,
        comment: '',
        day,
        projectName: block.title,
        taskType: 'Revision',
      });
    }
  }

  return entries;
}

export function useTimecard(plannerBlocks: TimeBlock[]) {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });

  const initialTimecard: WeeklyTimecard = useMemo(() => ({
    id: `tc-${format(monday, 'yyyy')}-w${format(monday, 'II')}`,
    weekStart: format(monday, 'yyyy-MM-dd'),
    entries: buildEntriesFromBlocks(plannerBlocks),
  }), []); // Only build once on mount

  const [timecard, setTimecard] = useLocalStorage<WeeklyTimecard>(
    STORAGE_KEY,
    initialTimecard
  );

  // ── Day summaries ─────────────────────
  const daySummaries: DaySummary[] = useMemo(() => {
    return WEEKDAYS.map((day) => {
      const dayEntries = timecard.entries.filter((e) => e.day === day);
      const adminHours = dayEntries
        .filter((e) => e.section === 'admin')
        .reduce((sum, e) => sum + e.hours, 0);
      const assignmentHours = dayEntries
        .filter((e) => e.section === 'assignment')
        .reduce((sum, e) => sum + e.hours, 0);
      return {
        day,
        totalHours: Math.round((adminHours + assignmentHours) * 100) / 100,
        adminHours: Math.round(adminHours * 100) / 100,
        assignmentHours: Math.round(assignmentHours * 100) / 100,
      };
    });
  }, [timecard.entries]);

  const weeklyTotal = useMemo(
    () => Math.round(daySummaries.reduce((sum, d) => sum + d.totalHours, 0) * 100) / 100,
    [daySummaries]
  );

  // ── Update entry hours ────────────────
  const updateEntryHours = useCallback(
    (entryId: string, hours: number) => {
      setTimecard((prev) => ({
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === entryId ? { ...e, hours: Math.max(0, hours) } : e
        ),
      }));
    },
    [setTimecard]
  );

  // ── Update entry comment ──────────────
  const updateEntryComment = useCallback(
    (entryId: string, comment: string) => {
      setTimecard((prev) => ({
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === entryId ? { ...e, comment } : e
        ),
      }));
    },
    [setTimecard]
  );

  // ── Get entries for a day ─────────────
  const getEntriesForDay = useCallback(
    (day: Weekday) => {
      const dayEntries = timecard.entries.filter((e) => e.day === day);
      return {
        admin: dayEntries.filter((e) => e.section === 'admin'),
        assignments: dayEntries.filter((e) => e.section === 'assignment'),
        all: dayEntries,
      };
    },
    [timecard.entries]
  );

  // ── Rebuild from planner blocks ───────
  const rebuildFromPlanner = useCallback(
    (blocks: TimeBlock[]) => {
      setTimecard((prev) => ({
        ...prev,
        entries: buildEntriesFromBlocks(blocks),
      }));
    },
    [setTimecard]
  );

  return {
    timecard,
    daySummaries,
    weeklyTotal,
    updateEntryHours,
    updateEntryComment,
    getEntriesForDay,
    rebuildFromPlanner,
  };
}
