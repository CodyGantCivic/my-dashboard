import { BarChart3, CalendarDays, Clock, Settings, Activity } from 'lucide-react';

export type View = 'metrics' | 'planner' | 'timecard';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

const NAV_ITEMS: { view: View; label: string; icon: typeof BarChart3 }[] = [
  { view: 'metrics', label: 'Metrics', icon: BarChart3 },
  { view: 'planner', label: 'Planner', icon: CalendarDays },
  { view: 'timecard', label: 'Timecard', icon: Clock },
];

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside
      style={{
        width: 220,
        minHeight: '100vh',
        background: '#ffffff',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '0 20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 16,
        }}
      >
        <Activity size={22} color="var(--color-primary)" />
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)' }}>
          WorkMetrics
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const active = activeView === view;
          return (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: active ? 'var(--color-primary-light)' : 'transparent',
                transition: 'all 0.15s',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '0 12px' }}>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: 'var(--color-text-muted)',
            background: 'transparent',
            width: '100%',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}
