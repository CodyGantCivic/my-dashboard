import { useState } from 'react';
import Sidebar, { type View } from './components/layout/Sidebar';
import MetricsDashboard from './components/metrics/MetricsDashboard';
import WeeklyPlanner from './components/planner/WeeklyPlanner';
import TimecardView from './components/timecard/TimecardView';

export default function App() {
  const [view, setView] = useState<View>('planner');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Sidebar activeView={view} onViewChange={setView} />

      <main
        style={{
          flex: 1,
          padding: '28px 32px',
          overflowX: 'auto',
          minWidth: 0,
        }}
      >
        {view === 'metrics' && <MetricsDashboard />}
        {view === 'planner' && <WeeklyPlanner />}
        {view === 'timecard' && <TimecardView />}
      </main>
    </div>
  );
}
