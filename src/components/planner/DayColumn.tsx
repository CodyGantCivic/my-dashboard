import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TimeBlock, Weekday } from '../../types/planner';
import { WEEKDAY_LABELS, WORK_START_HOUR, WORK_END_HOUR } from '../../types/planner';
import { TimeBlockCard } from './TimeBlockCard';
import { getDayMinutes } from '../../utils/plannerLogic';

interface DayColumnProps {
  day: Weekday;
  blocks: TimeBlock[];
  onRemoveBlock: (id: string) => void;
}

export const HOUR_SLOT_HEIGHT = 64;
export const DAY_HEADER_HEIGHT = 52;

export const DayColumn: React.FC<DayColumnProps> = ({ day, blocks, onRemoveBlock }) => {
  const dayMinutes = getDayMinutes(blocks, day);
  const dayHours = (dayMinutes / 60).toFixed(1);

  const totalHeight = (WORK_END_HOUR - WORK_START_HOUR) * HOUR_SLOT_HEIGHT;
  const sortableIds = blocks.map((b) => b.id);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        borderRight: '1px solid #e2e8f0',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: `${DAY_HEADER_HEIGHT}px`,
          padding: '0 12px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
          {WEEKDAY_LABELS[day]}
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
          {dayHours}h scheduled
        </div>
      </div>

      {/* Time Grid */}
      <div
        style={{
          position: 'relative',
          height: `${totalHeight}px`,
          overflow: 'hidden',
        }}
      >
        {/* Hour slot grid lines */}
        {Array.from({ length: WORK_END_HOUR - WORK_START_HOUR }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${i * HOUR_SLOT_HEIGHT}px`,
              left: 0,
              right: 0,
              height: `${HOUR_SLOT_HEIGHT}px`,
              borderBottom: '1px solid #f1f5f9',
            }}
          />
        ))}

        {/* Blocks — laid out with collision-aware heights */}
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {blocks.map((block, idx) => {
            const topOffset = (block.startHour - WORK_START_HOUR) * HOUR_SLOT_HEIGHT;
            const naturalHeight = (block.durationMinutes / 60) * HOUR_SLOT_HEIGHT;

            // Clamp height so it never overlaps the next block
            let maxHeight = naturalHeight;
            if (idx < blocks.length - 1) {
              const nextTop = (blocks[idx + 1].startHour - WORK_START_HOUR) * HOUR_SLOT_HEIGHT;
              const gap = nextTop - topOffset;
              // Leave a 2px visual gap between adjacent blocks
              maxHeight = Math.max(gap - 2, 20);
            }

            // Use natural height but never exceed gap to next block.
            // Minimum 20px so one line of text is always readable.
            const blockHeight = Math.max(Math.min(naturalHeight, maxHeight), 20);

            return (
              <div
                key={block.id}
                style={{
                  position: 'absolute',
                  top: `${topOffset + 1}px`,
                  left: '3px',
                  right: '3px',
                  height: `${blockHeight - 2}px`,
                  zIndex: 2,
                }}
              >
                <TimeBlockCard block={block} onRemove={onRemoveBlock} />
              </div>
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
};
