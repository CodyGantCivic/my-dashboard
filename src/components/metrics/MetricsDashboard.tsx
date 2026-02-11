import { useState, useMemo } from 'react';
import type { TimeScope } from '../../types/metrics';
import { useMetrics } from '../../hooks/useMetrics';
import { ScopeToggle } from './ScopeToggle';
import { MetricCard } from './MetricCard';
import { MetricsChart } from './MetricsChart';
import { format, parseISO } from 'date-fns';

const MetricsDashboard: React.FC = () => {
  const [scope, setScope] = useState<TimeScope>('weekly');
  const { records, summary, chartData } = useMetrics(scope);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const variance = useMemo(() => {
    const diff = summary.totalActualHours - summary.totalEstimatedHours;
    const pct =
      summary.totalEstimatedHours > 0
        ? ((diff / summary.totalEstimatedHours) * 100).toFixed(1)
        : '0';
    return {
      value: Math.abs(diff).toFixed(1),
      percent: parseFloat(pct),
      direction: diff > 0 ? ('up' as const) : ('down' as const),
    };
  }, [summary.totalActualHours, summary.totalEstimatedHours]);

  const onTimePercentage = useMemo(() => {
    return summary.onTimeRate.toFixed(1);
  }, [summary.onTimeRate]);

  const handleEditStart = (id: string, field: string, value: string) => {
    setEditingId(id);
    setEditingField(field);
    setEditingValue(value);
  };

  const handleEditSave = () => {
    if (editingId && editingField) {
      // In a real app, this would call updateRecord from useMetrics
      // For now, we'll just close the edit mode
      setEditingId(null);
      setEditingField(null);
      setEditingValue('');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingField(null);
    setEditingValue('');
  };

  return (
    <div
      style={{
        padding: '32px',
        backgroundColor: 'var(--color-background)',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: '32px',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '700',
            color: 'var(--color-text-primary)',
            margin: '0 0 16px 0',
          }}
        >
          Metrics
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            margin: '0 0 24px 0',
          }}
        >
          Track your performance across different time periods
        </p>

        {/* Scope Toggle */}
        <ScopeToggle currentScope={scope} onScopeChange={setScope} />
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <MetricCard
          label="Total Setups"
          value={summary.totalSetups}
          unit="builds"
        />
        <MetricCard
          label="Total Revisions"
          value={summary.totalRevisions}
          unit="changes"
        />
        <MetricCard
          label="Total Launches"
          value={summary.totalLaunches}
          unit="deploys"
        />
        <MetricCard
          label="Avg Completion"
          value={summary.avgCompletionPercent.toFixed(1)}
          unit="%"
        />
        <MetricCard
          label="Hours Variance"
          value={variance.value}
          unit="hrs"
          trend={{
            direction: variance.direction,
            percentage: variance.percent,
          }}
        />
        <MetricCard
          label="On-Time Rate"
          value={onTimePercentage}
          unit="%"
        />
      </div>

      {/* Charts */}
      <MetricsChart data={chartData} />

      {/* Data Table */}
      <div
        style={{
          marginTop: '32px',
          backgroundColor: 'var(--color-background)',
          border: `1px solid var(--color-border)`,
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: `1px solid var(--color-border)`,
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--color-text-primary)',
              margin: '0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Records
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  Period
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  Setups
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  Revisions
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  Launches
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  Est. Hours
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  Act. Hours
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  Complete %
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                >
                  On-Time
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr
                  key={record.id}
                  style={{
                    backgroundColor:
                      index % 2 === 0
                        ? 'transparent'
                        : 'var(--color-background-secondary)',
                    borderBottom: `1px solid var(--color-border)`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      'var(--color-primary-light)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      index % 2 === 0
                        ? 'transparent'
                        : 'var(--color-background-secondary)';
                  }}
                >
                  <td
                    style={{
                      padding: '12px 16px',
                      color: 'var(--color-text-primary)',
                      fontWeight: '500',
                    }}
                  >
                    {format(parseISO(record.periodStart), 'MMM dd, yyyy')}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      handleEditStart(
                        record.id,
                        'setups',
                        record.setups.standard.toString()
                      )
                    }
                  >
                    {editingId === record.id && editingField === 'setups' ? (
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: `1px solid var(--color-primary)`,
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.7 }}>
                        {record.setups.ultimate +
                          record.setups.premium +
                          record.setups.standard}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      handleEditStart(record.id, 'revisions', record.revisions.toString())
                    }
                  >
                    {editingId === record.id && editingField === 'revisions' ? (
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: `1px solid var(--color-primary)`,
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.7 }}>{record.revisions}</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      handleEditStart(record.id, 'launches', record.launches.toString())
                    }
                  >
                    {editingId === record.id && editingField === 'launches' ? (
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: `1px solid var(--color-primary)`,
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.7 }}>{record.launches}</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      handleEditStart(
                        record.id,
                        'estimatedHours',
                        record.estimatedHours.toString()
                      )
                    }
                  >
                    {editingId === record.id &&
                    editingField === 'estimatedHours' ? (
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                        step="0.1"
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: `1px solid var(--color-primary)`,
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.7 }}>
                        {record.estimatedHours.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      handleEditStart(
                        record.id,
                        'actualHours',
                        record.actualHours.toString()
                      )
                    }
                  >
                    {editingId === record.id && editingField === 'actualHours' ? (
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                        step="0.1"
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: `1px solid var(--color-primary)`,
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.7 }}>
                        {record.actualHours.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      handleEditStart(
                        record.id,
                        'completionPercentage',
                        record.completionPercentage.toString()
                      )
                    }
                  >
                    {editingId === record.id &&
                    editingField === 'completionPercentage' ? (
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                        min="0"
                        max="100"
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: `1px solid var(--color-primary)`,
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                    ) : (
                      <span style={{ opacity: 0.7 }}>
                        {record.completionPercentage.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: record.completedOnTime
                        ? 'var(--color-success)'
                        : 'var(--color-danger)',
                      fontWeight: '500',
                    }}
                  >
                    {record.completedOnTime ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {records.length === 0 && (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ margin: '0', fontSize: '14px' }}>
              No records found for this period
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsDashboard;
