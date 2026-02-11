import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
  unit?: string;
  subtitle?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  unit,
  subtitle,
}) => {
  const trendColor =
    trend?.direction === 'up' ? 'var(--color-success)' : 'var(--color-danger)';
  const TrendIcon = trend?.direction === 'up' ? ArrowUp : ArrowDown;

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: 'var(--color-background)',
        border: `1px solid var(--color-border)`,
        borderRadius: '12px',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 4px 12px rgba(0, 0, 0, 0.08)';
        (e.currentTarget as HTMLDivElement).style.borderColor =
          'var(--color-primary-light)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor =
          'var(--color-border)';
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <p
          style={{
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--color-text-secondary)',
            margin: '0 0 4px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {label}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: subtitle ? '8px' : '0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <p
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--color-text-primary)',
              margin: '0',
            }}
          >
            {value}
          </p>
          {unit && (
            <span
              style={{
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                fontWeight: '500',
              }}
            >
              {unit}
            </span>
          )}
        </div>

        {trend && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: trendColor,
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            <TrendIcon size={14} />
            <span>{Math.abs(trend.percentage)}%</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            margin: '0',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};
