import { useState, useMemo } from 'react';
import { Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import type { Weekday } from '../../types/planner';
import { WEEKDAYS, WEEKDAY_LABELS } from '../../types/planner';
import type { TimecardEntry } from '../../types/timecard';
import { formatTimecardHours } from '../../types/timecard';
import { useTimecard } from '../../hooks/useTimecard';
import { usePlanner } from '../../hooks/usePlanner';
import { startOfWeek, addDays, format } from 'date-fns';

const MAX_DAILY_HOURS = 8;
const MAX_WEEKLY_HOURS = 40;

const DAY_SHORT: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
};

/** Compute day dates dynamically from the current week. */
function getDayDates(): Record<Weekday, string> {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return {
    monday: format(monday, 'MMM-dd'),
    tuesday: format(addDays(monday, 1), 'MMM-dd'),
    wednesday: format(addDays(monday, 2), 'MMM-dd'),
    thursday: format(addDays(monday, 3), 'MMM-dd'),
    friday: format(addDays(monday, 4), 'MMM-dd'),
  };
}

/** Compute week summary from planner blocks. */
function computeWeekSummary(blocks: { type: string; title?: string; durationMinutes: number }[]) {
  const setups = blocks.filter((b) => b.type.startsWith('setup-'));
  const launches = blocks.filter((b) => b.type === 'launch');
  const revisions = blocks.filter((b) => b.type === 'revision');

  // Deduplicate by title (a multi-day setup has multiple blocks)
  const uniqueUlt = new Set(blocks.filter((b) => b.type === 'setup-ultimate').map((b) => b.title)).size;
  const uniquePrem = new Set(blocks.filter((b) => b.type === 'setup-premium').map((b) => b.title)).size;
  const uniqueStd = new Set(blocks.filter((b) => b.type === 'setup-standard').map((b) => b.title)).size;

  return {
    setups: {
      ultimate: uniqueUlt,
      premium: uniquePrem,
      standard: uniqueStd,
      total: new Set(setups.map((b) => b.title ?? '')).size,
    },
    launches: new Set(launches.map((b) => b.title ?? '')).size,
    revisions: new Set(revisions.map((b) => b.title ?? '')).size,
    totalRevisionHours: Math.round(revisions.reduce((sum, b) => sum + b.durationMinutes / 60, 0) * 10) / 10,
  };
}

/** Color dot for entry type */
function entryDotColor(entry: TimecardEntry): string {
  if (entry.section === 'admin') {
    if (entry.category === 'internal-meeting') return '#c25d5d';
    if (entry.category === 'non-exempt-breaks') return '#d4dae0';
    return '#8e99a4';
  }
  if (entry.taskType === 'Website Launch') return '#5aa87a';
  if (entry.taskType === 'Revision') return '#c8944a';
  if (entry.taskType === 'Design Setup') {
    if (entry.category?.includes('ultimate') || entry.label.toLowerCase().includes('ultimate'))
      return '#6d5acd';
    if (entry.category?.includes('premium') || entry.label.toLowerCase().includes('premium'))
      return '#5b8bd4';
    return '#6aabb7';
  }
  return '#4f6ef7';
}

export default function TimecardView() {
  const { plan } = usePlanner();
  const {
    daySummaries,
    weeklyTotal,
    updateEntryHours,
    updateEntryComment,
    getEntriesForDay,
    rebuildFromPlanner,
  } = useTimecard(plan.blocks);

  const [activeDay, setActiveDay] = useState<Weekday>('monday');

  const DAY_DATES = useMemo(() => getDayDates(), []);
  const weekSummary = useMemo(() => computeWeekSummary(plan.blocks), [plan.blocks]);

  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const weekRangeLabel = `${format(monday, 'M/d/yy')} – ${format(friday, 'M/d/yy')}`;

  const dayEntries = useMemo(() => getEntriesForDay(activeDay), [getEntriesForDay, activeDay]);

  const activeDaySummary = daySummaries.find((d) => d.day === activeDay);
  const activeDayHours = activeDaySummary?.totalHours ?? 0;
  const dailyOver = activeDayHours > MAX_DAILY_HOURS;
  const weeklyOver = weeklyTotal > MAX_WEEKLY_HOURS;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock size={24} color="var(--color-primary)" />
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              Time
            </h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {weekRangeLabel}
            </span>
          </div>
        </div>
        <button
          onClick={() => rebuildFromPlanner(plan.blocks)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
            fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={14} />
          Sync from Planner
        </button>
      </div>

      {/* Over-hours warnings */}
      {(weeklyOver || dailyOver) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {weeklyOver && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                fontSize: '0.85rem',
                color: '#991b1b',
              }}
            >
              <AlertTriangle size={16} />
              Weekly total is {formatTimecardHours(weeklyTotal)} — exceeds {MAX_WEEKLY_HOURS}h limit. Manager approval needed for overtime.
            </div>
          )}
          {dailyOver && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: '0.85rem',
                color: '#92400e',
              }}
            >
              <AlertTriangle size={16} />
              {WEEKDAY_LABELS[activeDay]} total is {formatTimecardHours(activeDayHours)} — exceeds {MAX_DAILY_HOURS}h daily limit.
            </div>
          )}
        </div>
      )}

      {/* Week Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <SummaryCard
          label="Setups"
          value={weekSummary.setups.total}
          detail={weekSummary.setups.total > 0 ? `${weekSummary.setups.ultimate}U / ${weekSummary.setups.premium}P / ${weekSummary.setups.standard}S` : 'none yet'}
          color="#7c3aed"
        />
        <SummaryCard
          label="Launches"
          value={weekSummary.launches}
          detail="this week"
          color="#059669"
        />
        <SummaryCard
          label="Revisions"
          value={weekSummary.revisions}
          detail={weekSummary.revisions > 0 ? `${weekSummary.totalRevisionHours}h estimated` : 'none yet'}
          color="#d97706"
        />
        <SummaryCard
          label="Rev. Hours"
          value={weekSummary.totalRevisionHours}
          detail="estimated"
          color="#d97706"
        />
        <SummaryCard
          label="Week Total"
          value={weeklyTotal}
          detail={`of ${MAX_WEEKLY_HOURS}h limit`}
          color={weeklyOver ? '#dc2626' : weeklyTotal >= 39 ? '#059669' : 'var(--color-text)'}
        />
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Main content */}
        <div style={{ flex: 1 }}>
          {/* Day tabs */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '2px solid var(--color-border)',
              marginBottom: 20,
            }}
          >
            {WEEKDAYS.map((day) => {
              const isActive = day === activeDay;
              const ds = daySummaries.find((d) => d.day === day);
              const dayOver = (ds?.totalHours ?? 0) > MAX_DAILY_HOURS;
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontFamily: 'inherit',
                    marginBottom: -2,
                    transition: 'all 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span>{DAY_SHORT[day]}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7, color: dayOver ? '#dc2626' : undefined }}>
                    {ds ? formatTimecardHours(ds.totalHours) : '0:00'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Combined Entries Table */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 100px 1fr',
                gap: 0,
                padding: '10px 16px',
                borderBottom: '1px solid var(--color-border)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'var(--color-surface-alt)',
              }}
            >
              <span>Task</span>
              <span style={{ color: '#dc2626' }}>* Date</span>
              <span style={{ color: '#dc2626' }}>* Hours</span>
              <span>Comment</span>
            </div>

            {dayEntries.all.length === 0 ? (
              <div style={{ padding: '24px 16px', color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                No entries for {WEEKDAY_LABELS[activeDay]}
              </div>
            ) : (
              dayEntries.all.map((entry) => (
                <TimecardRow
                  key={entry.id}
                  entry={entry}
                  date={DAY_DATES[activeDay]}
                  onHoursChange={(h) => updateEntryHours(entry.id, h)}
                  onCommentChange={(c) => updateEntryComment(entry.id, c)}
                />
              ))
            )}

            {/* Day total footer */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 100px 1fr',
                gap: 0,
                padding: '10px 16px',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface-alt)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <span style={{ color: 'var(--color-text)' }}>{WEEKDAY_LABELS[activeDay]} Total</span>
              <span />
              <span style={{ color: dailyOver ? '#dc2626' : 'var(--color-text)' }}>
                {formatTimecardHours(activeDayHours)}{dailyOver ? ' ⚠' : ''}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                / {MAX_DAILY_HOURS}:00 max
              </span>
            </div>
          </div>
        </div>

        {/* Right sidebar: Entered Hours Summary */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            padding: 20,
            alignSelf: 'flex-start',
            position: 'sticky',
            top: 28,
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--color-text)',
              margin: '0 0 16px',
            }}
          >
            Entered Hours Summary
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px 12px',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Day</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Hours</span>

            {daySummaries.map((ds) => (
              <SummaryRow
                key={ds.day}
                label={DAY_SHORT[ds.day].toUpperCase()}
                hours={ds.totalHours}
                isActive={ds.day === activeDay}
                isOver={ds.totalHours > MAX_DAILY_HOURS}
              />
            ))}

            <div
              style={{
                gridColumn: '1 / -1',
                borderTop: '1px solid var(--color-border)',
                margin: '8px 0 4px',
              }}
            />
            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>TOTAL</span>
            <span
              style={{
                fontWeight: 700,
                textAlign: 'right',
                color: weeklyOver ? '#dc2626' : weeklyTotal >= 39 ? '#059669' : 'var(--color-text)',
              }}
            >
              {formatTimecardHours(weeklyTotal)}
            </span>
            {weeklyOver && (
              <span style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#dc2626', textAlign: 'center', marginTop: 4 }}>
                Over {MAX_WEEKLY_HOURS}h — needs approval
              </span>
            )}
          </div>

          {/* Project breakdown */}
          <div style={{ marginTop: 20, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              This Week
            </h4>
            {plan.blocks.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Import data to see breakdown
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#7c3aed' }}>Setups</span>
                  <span style={{ fontWeight: 600 }}>{weekSummary.setups.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#059669' }}>Launches</span>
                  <span style={{ fontWeight: 600 }}>{weekSummary.launches}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#d97706' }}>Revisions</span>
                  <span style={{ fontWeight: 600 }}>{weekSummary.revisions}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function TimecardRow({
  entry,
  date,
  onHoursChange,
  onCommentChange,
}: {
  entry: TimecardEntry;
  date: string;
  onHoursChange: (hours: number) => void;
  onCommentChange: (comment: string) => void;
}) {
  const dotColor = entryDotColor(entry);
  const isAssignment = entry.section === 'assignment';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 100px 1fr',
        gap: 0,
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        alignItems: 'center',
      }}
    >
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '0.83rem',
            color: isAssignment ? 'var(--color-text)' : 'var(--color-text-secondary)',
            fontWeight: isAssignment ? 500 : 400,
            lineHeight: 1.3,
          }}
        >
          {entry.label}
        </span>
      </div>

      {/* Date */}
      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
        {date}
      </span>

      {/* Hours input */}
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          step="0.25"
          min="0"
          max="12"
          value={entry.hours || ''}
          onChange={(e) => onHoursChange(parseFloat(e.target.value) || 0)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            color: 'var(--color-text)',
            background: 'var(--color-surface)',
            outline: 'none',
          }}
          placeholder="0"
        />
        <Clock
          size={12}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Comment */}
      <textarea
        value={entry.comment}
        onChange={(e) => onCommentChange(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          fontSize: '0.82rem',
          fontFamily: 'inherit',
          color: 'var(--color-text)',
          background: 'var(--color-surface)',
          resize: 'vertical',
          minHeight: 32,
          maxHeight: 80,
          outline: 'none',
          marginLeft: 8,
        }}
        placeholder="Add comment..."
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        padding: '16px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
        {detail}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  hours,
  isActive,
  isOver,
}: {
  label: string;
  hours: number;
  isActive: boolean;
  isOver: boolean;
}) {
  return (
    <>
      <span
        style={{
          color: isOver ? '#dc2626' : isActive ? 'var(--color-primary)' : 'var(--color-text)',
          fontWeight: isActive ? 600 : 400,
          padding: '4px 0',
        }}
      >
        {label}
      </span>
      <span
        style={{
          textAlign: 'right',
          color: isOver ? '#dc2626' : isActive ? 'var(--color-primary)' : 'var(--color-text)',
          fontWeight: isActive ? 600 : 400,
          padding: '4px 0',
        }}
      >
        {formatTimecardHours(hours)}
      </span>
    </>
  );
}
