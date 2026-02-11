import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lock, X } from 'lucide-react';
import type { TimeBlock } from '../../types/planner';
import { BLOCK_COLORS, BLOCK_LABELS } from '../../types/planner';
import { formatHour } from '../../utils/plannerLogic';

interface TimeBlockCardProps {
  block: TimeBlock;
  onRemove: (id: string) => void;
}

export const TimeBlockCard: React.FC<TimeBlockCardProps> = ({ block, onRemove }) => {
  const [isHovering, setIsHovering] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const blockColor = BLOCK_COLORS[block.type];
  const isDarkText = block.type === 'break';
  const textColor = isDarkText ? '#374151' : '#ffffff';
  const isShort = block.durationMinutes < 30;

  const endHour = block.startHour + block.durationMinutes / 60;
  const timeRange = `${formatHour(block.startHour)} – ${formatHour(endHour)}`;

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(block.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        height: '100%',
        backgroundColor: blockColor,
        borderRadius: '5px',
        padding: isShort ? '1px 4px' : '3px 6px',
        cursor: isDragging ? 'grabbing' : block.locked ? 'default' : 'grab',
        color: textColor,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: '0px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        border: `1px solid ${isDarkText ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'}`,
        overflow: 'hidden',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      {...(block.locked ? {} : { ...attributes, ...listeners })}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: block.durationMinutes < 30 ? '10px' : '11px',
              fontWeight: '600',
              lineHeight: '1.2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: block.durationMinutes >= 60 ? 3 : 1,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {block.title || BLOCK_LABELS[block.type]}
          </span>
          {block.durationMinutes >= 45 && (
            <span style={{ fontSize: '9px', opacity: 0.8, lineHeight: '1.1', whiteSpace: 'nowrap' }}>
              {timeRange}
            </span>
          )}
        </div>
        {block.locked && (
          <Lock
            size={12}
            style={{ flexShrink: 0, marginLeft: '3px', opacity: 0.6, marginTop: '1px' }}
          />
        )}
      </div>

      {!block.locked && isHovering && (
        <button
          onClick={handleRemoveClick}
          style={{
            position: 'absolute',
            top: '3px',
            right: '3px',
            width: '18px',
            height: '18px',
            borderRadius: '3px',
            border: 'none',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            color: textColor,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};
