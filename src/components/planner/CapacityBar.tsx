import React from 'react';
import type { CapacitySummary } from '../../types/planner';

interface CapacityBarProps {
  capacity: CapacitySummary;
}

export const CapacityBar: React.FC<CapacityBarProps> = ({ capacity }) => {
  const totalMinutes = capacity.totalAvailableMinutes;
  const workPercent = (capacity.totalWorkMinutes / totalMinutes) * 100;
  const bufferPercent = (capacity.totalBufferMinutes / totalMinutes) * 100;
  const breakPercent = (capacity.totalBreakMinutes / totalMinutes) * 100;

  const statusColor =
    capacity.status === 'over'
      ? '#ef4444'
      : capacity.status === 'balanced'
        ? '#10b981'
        : '#f59e0b';

  const workHours = (capacity.totalWorkMinutes / 60).toFixed(1);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
          Weekly Capacity
        </span>
        <span
          style={{
            fontSize: '13px',
            color: '#6b7280',
            fontWeight: '500',
          }}
        >
          {workHours}h / {totalHours}h • {capacity.utilizationPercent}% utilized
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          height: '24px',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#e5e7eb',
          border: `2px solid ${statusColor}`,
        }}
      >
        {workPercent > 0 && (
          <div
            style={{
              width: `${workPercent}%`,
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease',
            }}
          />
        )}
        {bufferPercent > 0 && (
          <div
            style={{
              width: `${bufferPercent}%`,
              backgroundColor: '#94a3b8',
              transition: 'width 0.3s ease',
            }}
          />
        )}
        {breakPercent > 0 && (
          <div
            style={{
              width: `${breakPercent}%`,
              backgroundColor: '#cbd5e1',
              transition: 'width 0.3s ease',
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          fontSize: '12px',
          color: '#6b7280',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}
          />
          Work: {(capacity.totalWorkMinutes / 60).toFixed(1)}h
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            style={{ width: '12px', height: '12px', backgroundColor: '#94a3b8', borderRadius: '2px' }}
          />
          Buffer: {(capacity.totalBufferMinutes / 60).toFixed(1)}h
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            style={{ width: '12px', height: '12px', backgroundColor: '#cbd5e1', borderRadius: '2px' }}
          />
          Breaks: {(capacity.totalBreakMinutes / 60).toFixed(1)}h
        </div>
      </div>
    </div>
  );
};
