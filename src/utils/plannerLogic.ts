import type { TimeBlock, CapacitySummary, Weekday } from '../types/planner';
import { WEEKDAYS, WORK_START_HOUR, WORK_END_HOUR } from '../types/planner';

const TOTAL_WEEKLY_MINUTES = 40 * 60; // 2400

/** Calculate capacity summary for a weekly plan. */
export function calculateCapacity(blocks: TimeBlock[]): CapacitySummary {
  let totalScheduled = 0;
  let totalBreak = 0;
  let totalBuffer = 0;

  for (const b of blocks) {
    totalScheduled += b.durationMinutes;
    if (b.type === 'break') totalBreak += b.durationMinutes;
    if (b.type === 'buffer') totalBuffer += b.durationMinutes;
  }

  const totalWork = totalScheduled - totalBreak - totalBuffer;
  const remaining = TOTAL_WEEKLY_MINUTES - totalScheduled;
  const utilization = (totalScheduled / TOTAL_WEEKLY_MINUTES) * 100;

  let status: CapacitySummary['status'] = 'balanced';
  if (totalScheduled < TOTAL_WEEKLY_MINUTES - 60) status = 'under';
  if (totalScheduled > TOTAL_WEEKLY_MINUTES) status = 'over';

  return {
    totalAvailableMinutes: TOTAL_WEEKLY_MINUTES,
    totalScheduledMinutes: totalScheduled,
    totalBreakMinutes: totalBreak,
    totalBufferMinutes: totalBuffer,
    totalWorkMinutes: totalWork,
    remainingMinutes: remaining,
    utilizationPercent: Math.round(utilization),
    status,
  };
}

/** Check for time conflicts on a given day. */
export function findConflicts(blocks: TimeBlock[], day: Weekday): [TimeBlock, TimeBlock][] {
  const dayBlocks = blocks
    .filter((b) => b.day === day)
    .sort((a, b) => a.startHour - b.startHour);

  const conflicts: [TimeBlock, TimeBlock][] = [];
  for (let i = 0; i < dayBlocks.length - 1; i++) {
    const current = dayBlocks[i];
    const next = dayBlocks[i + 1];
    const currentEnd = current.startHour + current.durationMinutes / 60;
    if (currentEnd > next.startHour) {
      conflicts.push([current, next]);
    }
  }
  return conflicts;
}

/** Get all blocks for a specific day, sorted by start time. */
export function getBlocksForDay(blocks: TimeBlock[], day: Weekday): TimeBlock[] {
  return blocks.filter((b) => b.day === day).sort((a, b) => a.startHour - b.startHour);
}

/** Find first available slot on a given day for a given duration. */
export function findAvailableSlot(
  blocks: TimeBlock[],
  day: Weekday,
  durationMinutes: number
): number | null {
  const dayBlocks = getBlocksForDay(blocks, day);
  const durationHours = durationMinutes / 60;

  let candidate = WORK_START_HOUR;

  for (const block of dayBlocks) {
    if (candidate + durationHours <= block.startHour) {
      return candidate;
    }
    const blockEnd = block.startHour + block.durationMinutes / 60;
    if (blockEnd > candidate) {
      candidate = blockEnd;
    }
  }

  // Check if fits after last block
  if (candidate + durationHours <= WORK_END_HOUR) {
    return candidate;
  }

  return null;
}

/** Auto-generate break blocks (30 min per day around noon). */
export function generateBreaks(existingBlocks: TimeBlock[]): TimeBlock[] {
  const breaks: TimeBlock[] = [];

  for (const day of WEEKDAYS) {
    // Try to place break at 12:00, then search nearby
    const preferredHour = 12;
    const slot = findAvailableSlot(
      existingBlocks.filter((b) => b.day === day),
      day,
      30
    );

    breaks.push({
      id: `break-${day}`,
      type: 'break',
      title: 'Break',
      durationMinutes: 30,
      day,
      startHour: slot !== null && Math.abs(slot - preferredHour) < 2 ? slot : preferredHour,
      locked: false,
    });
  }

  return breaks;
}

/** Generate a unique ID. */
export function generateId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Snap a decimal hour to nearest 0.5 increment. */
export function snapToHalfHour(hour: number): number {
  return Math.round(hour * 2) / 2;
}

/** Format hour as time string, e.g. 13.5 → "1:30 PM" */
export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

/** Get per-day scheduled minutes. */
export function getDayMinutes(blocks: TimeBlock[], day: Weekday): number {
  return blocks
    .filter((b) => b.day === day)
    .reduce((sum, b) => sum + b.durationMinutes, 0);
}
