import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { format } from 'date-fns';
import { RotateCcw, Plus, Download } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import type { BlockType, TimeBlock } from '../../types/planner';
import { WEEKDAYS, WEEKDAY_LABELS, BLOCK_LABELS, WORK_START_HOUR, WORK_END_HOUR } from '../../types/planner';
import { getBlocksForDay, formatHour } from '../../utils/plannerLogic';
import { HOUR_SLOT_HEIGHT, DAY_HEADER_HEIGHT } from './DayColumn';
import { CapacityBar } from './CapacityBar';
import { DayColumn } from './DayColumn';
import { ImportWizard } from './ImportWizard';

interface AddBlockFormState {
  type: BlockType;
  title: string;
  day: typeof WEEKDAYS[number];
  startHour: number;
  durationMinutes: number;
}

const WeeklyPlanner: React.FC = () => {
  const { plan, capacity, addBlock, removeBlock, resetPlan, moveBlock, importBlocks } = usePlanner();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formState, setFormState] = useState<AddBlockFormState>({
    type: 'meeting',
    title: '',
    day: 'monday',
    startHour: WORK_START_HOUR,
    durationMinutes: 60,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const weekStart = plan ? new Date(plan.weekStart) : new Date();
  const weekLabel = `Week of ${format(weekStart, 'MMM d, yyyy')}`;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const blockId = active.id as string;
    const block = plan?.blocks.find((b) => b.id === blockId);

    if (block && over.id) {
      moveBlock(blockId, block.day, block.startHour);
    }
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (formState.title.trim()) {
      addBlock({
        type: formState.type,
        title: formState.title,
        day: formState.day,
        startHour: formState.startHour,
        durationMinutes: formState.durationMinutes,
      });
      setFormState({
        type: 'meeting',
        title: '',
        day: 'monday',
        startHour: WORK_START_HOUR,
        durationMinutes: 60,
      });
      setShowAddForm(false);
    }
  };

  if (!plan) {
    return <div style={{ padding: '16px' }}>Loading planner...</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827' }}>
            {weekLabel}
          </h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setShowImport(!showImport); setShowAddForm(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: showImport ? '1px solid #3b82f6' : '1px solid #d1d5db',
                backgroundColor: showImport ? '#eff6ff' : '#ffffff',
                color: showImport ? '#1d4ed8' : '#374151',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!showImport) e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                if (!showImport) e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <Download size={16} />
              Import Sources
            </button>
            <button
              onClick={() => { setShowAddForm(!showAddForm); setShowImport(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <Plus size={16} />
              Add Block
            </button>
            <button
              onClick={() => resetPlan()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>

        {/* Import Wizard */}
        {showImport && (
          <ImportWizard
            onClose={() => setShowImport(false)}
            onImport={(blocks: TimeBlock[]) => importBlocks(blocks)}
          />
        )}

        {/* Add Block Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddBlock}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>Type</label>
              <select
                value={formState.type}
                onChange={(e) => setFormState({ ...formState, type: e.target.value as BlockType })}
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                }}
              >
                {Object.entries(BLOCK_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>Title</label>
              <input
                type="text"
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                placeholder="Block title"
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>Day</label>
              <select
                value={formState.day}
                onChange={(e) => setFormState({ ...formState, day: e.target.value as any })}
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                }}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {WEEKDAY_LABELS[day]}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>Start Hour</label>
              <select
                value={formState.startHour}
                onChange={(e) => setFormState({ ...formState, startHour: parseInt(e.target.value) })}
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                }}
              >
                {Array.from({ length: WORK_END_HOUR - WORK_START_HOUR }).map((_, i) => {
                  const hour = WORK_START_HOUR + i;
                  return (
                    <option key={hour} value={hour}>
                      {hour}:00
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>
                Duration (minutes)
              </label>
              <input
                type="number"
                value={formState.durationMinutes}
                onChange={(e) => setFormState({ ...formState, durationMinutes: parseInt(e.target.value) })}
                min="15"
                step="15"
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <button
                type="submit"
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Capacity Bar */}
        <CapacityBar capacity={capacity} />

        {/* Weekly Grid */}
        <div
          style={{
            display: 'flex',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          {/* Time Gutter */}
          <div
            style={{
              width: '56px',
              flexShrink: 0,
              borderRight: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
            }}
          >
            {/* Header spacer */}
            <div style={{ height: `${DAY_HEADER_HEIGHT}px`, borderBottom: '1px solid #e2e8f0' }} />
            {/* Hour labels */}
            <div style={{ position: 'relative' }}>
              {Array.from({ length: WORK_END_HOUR - WORK_START_HOUR }).map((_, i) => {
                const hour = WORK_START_HOUR + i;
                return (
                  <div
                    key={i}
                    style={{
                      height: `${HOUR_SLOT_HEIGHT}px`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                      paddingRight: '8px',
                      paddingTop: '4px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#94a3b8',
                        fontWeight: '500',
                        lineHeight: '1',
                      }}
                    >
                      {formatHour(hour)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day Columns */}
          {WEEKDAYS.map((day) => (
            <DayColumn
              key={day}
              day={day}
              blocks={getBlocksForDay(plan.blocks, day)}
              onRemoveBlock={removeBlock}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
};

export default WeeklyPlanner;
