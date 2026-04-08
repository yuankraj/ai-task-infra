import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUSES = ['all', 'pending', 'running', 'success', 'failed'];

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      const params = { page, limit: 20 };
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/tasks', { params });
      setTasks(data.tasks);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
    const interval = setInterval(fetchTasks, 8000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
  };

  const handleDelete = async (e, taskId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this task?')) return;
    setDeletingId(taskId);
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted');
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="main-content animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Tasks</h1>
          <p style={{ marginTop: '4px' }}>
            {pagination.total ?? 0} total tasks
          </p>
        </div>
        <Link to="/tasks/new" className="btn btn-primary" id="create-task-btn">
          ⚡ New Task
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            id={`filter-${s}`}
            onClick={() => handleFilterChange(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="spinner spinner-page" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3 className="empty-title">No tasks found</h3>
            <p className="empty-desc">
              {filter !== 'all'
                ? `No ${filter} tasks. Try a different filter.`
                : 'Create your first task to get started.'}
            </p>
            {filter === 'all' && (
              <Link to="/tasks/new" className="btn btn-primary">Create Task</Link>
            )}
          </div>
        </div>
      ) : (
        <div className="tasks-grid">
          {tasks.map((task) => (
            <Link
              key={task._id}
              to={`/tasks/${task._id}`}
              className="task-card"
              style={{ textDecoration: 'none' }}
              id={`task-${task._id}`}
            >
              <div className="task-card-header">
                <span className="task-title truncate" style={{ maxWidth: '70%' }}>
                  {task.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusBadge status={task.status} />
                  {(task.status === 'success' || task.status === 'failed') && (
                    <button
                      onClick={(e) => handleDelete(e, task._id)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '4px 8px', position: 'relative', zIndex: 2 }}
                      disabled={deletingId === task._id}
                    >
                      {deletingId === task._id ? <span className="spinner spinner-sm" /> : '🗑'}
                    </button>
                  )}
                </div>
              </div>
              <div className="task-meta">
                <span className="task-operation">{task.operation}</span>
                {task.processingTimeMs && (
                  <span className="task-date">⚡ {task.processingTimeMs}ms</span>
                )}
                <span className="task-date">
                  {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Page {page} of {pagination.totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasNext}
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
}
