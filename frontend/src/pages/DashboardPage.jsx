import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { background: color, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, tasksRes] = await Promise.all([
        api.get('/tasks/stats'),
        api.get('/tasks?limit=5')
      ]);
      setStats(statsRes.data.stats);
      setRecentTasks(tasksRes.data.tasks);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-page" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <main className="main-content animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>{greeting}, {user?.username} 👋</h1>
          <p style={{ marginTop: '4px' }}>Here's what's happening with your tasks.</p>
        </div>
        <Link to="/tasks/new" className="btn btn-primary">
          ⚡ New Task
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid mb-8">
          <StatCard value={stats.total} label="Total Tasks" />
          <StatCard
            value={stats.pending}
            label="Pending"
            color="linear-gradient(135deg, #f59e0b, #d97706)"
          />
          <StatCard
            value={stats.running}
            label="Running"
            color="linear-gradient(135deg, #7c3aed, #9333ea)"
          />
          <StatCard
            value={stats.success}
            label="Succeeded"
            color="linear-gradient(135deg, #10b981, #059669)"
          />
          <StatCard
            value={stats.failed}
            label="Failed"
            color="linear-gradient(135deg, #ef4444, #dc2626)"
          />
        </div>
      )}

      {/* Recent Tasks */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontSize: '1.1rem' }}>Recent Tasks</h2>
          <Link to="/tasks" className="btn btn-ghost btn-sm">View all →</Link>
        </div>

        {recentTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3 className="empty-title">No tasks yet</h3>
            <p className="empty-desc">Create your first task to get started.</p>
            <Link to="/tasks/new" className="btn btn-primary">Create Task</Link>
          </div>
        ) : (
          <div className="tasks-grid">
            {recentTasks.map((task) => (
              <Link
                key={task._id}
                to={`/tasks/${task._id}`}
                className="task-card"
                style={{ textDecoration: 'none' }}
              >
                <div className="task-card-header">
                  <span className="task-title">{task.title}</span>
                  <StatusBadge status={task.status} />
                </div>
                <div className="task-meta">
                  <span className="task-operation">{task.operation}</span>
                  <span className="task-date">
                    {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Start */}
      <div className="card mt-6" style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
        border: '1px solid rgba(124,58,237,0.25)'
      }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>⚡ Supported Operations</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { op: 'uppercase', desc: 'Convert text to UPPERCASE' },
            { op: 'lowercase', desc: 'Convert text to lowercase' },
            { op: 'reverse', desc: 'Reverse the string' },
            { op: 'word_count', desc: 'Count words & characters' }
          ].map(({ op, desc }) => (
            <div key={op} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              flex: '1',
              minWidth: '180px'
            }}>
              <code style={{ color: 'var(--color-accent-soft)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                {op}
              </code>
              <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
