import React from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MetricsChartPoint } from '../../types/metrics';

interface MetricsChartProps {
  data: MetricsChartPoint[];
}

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-background)',
          border: `1px solid var(--color-border)`,
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            style={{
              color: entry.color,
              fontSize: '12px',
              margin: '4px 0',
              fontWeight: '500',
            }}
          >
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const MetricsChart: React.FC<MetricsChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p style={{ margin: '0', fontSize: '14px' }}>No data available</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '24px',
        padding: '24px',
        backgroundColor: 'var(--color-background)',
        border: `1px solid var(--color-border)`,
        borderRadius: '12px',
      }}
    >
      {/* Bar Chart: Setups, Revisions, Launches */}
      <div style={{ flex: 1, minHeight: '400px' }}>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--color-text-primary)',
            margin: '0 0 16px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Activity Overview
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={data}
            margin={{ top: 0, right: 16, left: 0, bottom: 40 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="var(--color-text-secondary)"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="var(--color-text-secondary)"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '16px' }}
              iconType="square"
            />
            <Bar dataKey="setups" fill="#4f6ef7" name="Setups" radius={4} />
            <Bar dataKey="revisions" fill="#d97706" name="Revisions" radius={4} />
            <Bar dataKey="launches" fill="#059669" name="Launches" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Area Chart: Estimated vs Actual Hours */}
      <div style={{ flex: 1, minHeight: '400px' }}>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--color-text-primary)',
            margin: '0 0 16px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Hours Analysis
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart
            data={data}
            margin={{ top: 0, right: 16, left: 0, bottom: 40 }}
          >
            <defs>
              <linearGradient id="colorEstimated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="var(--color-text-secondary)"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="var(--color-text-secondary)"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '16px' }}
              iconType="line"
            />
            <Area
              type="monotone"
              dataKey="estimated"
              stroke="#94a3b8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorEstimated)"
              name="Estimated Hours"
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#4f6ef7"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorActual)"
              name="Actual Hours"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
