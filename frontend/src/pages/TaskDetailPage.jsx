import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';

function LogViewer({ logs }) {
  if (!logs?.length) return (
    <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', padding: '8px 0' }}>
      No logs yet...
    </div>
  );
  return (
    <div className="log-viewer">
      {logs.map((log, i) => (
        <div key={i} className="log-entry">
          <span className="log-ts">
            {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
          </span>
          <span className={`log-level-${log.level}`}>[{log.level.toUpperCase()}]</span>
          <span className="log-msg">{log.message}</span>
        </div>
      ))}
    </div>
  );
}

function ResultDisplay({ operation, result }) {
  if (!result) return null;

  if (operation === 'word_count') {
    const entries = [
      ['Words', result.wordCount],
      ['Unique Words', result.uniqueWordCount],
      ['Characters', result.characterCount],
      ['Chars (no spaces)', result.characterCountNoSpaces],
      ['Sentences', result.sentenceCount],
      ['Paragraphs', result.paragraphCount],
      ['Avg Word Length', result.averageWordLength],
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {entries.map(([label, value]) => (
          <div key={label} style={{
            background: 'var(--color-success-bg)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="result-box">
      {result.output ?? JSON.stringify(result, null, 2)}
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchTask = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/${id}`);
      setTask(data.task);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Task not found');
        navigate('/tasks', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Poll while pending or running
  useEffect(() => {
    if (!task) return;
    if (task.status === 'pending' || task.status === 'running') {
      const interval = setInterval(fetchTask, 2000);
      return () => clearInterval(interval);
    }
  }, [task, fetchTask]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this task permanently?')) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${id}`);
      toast.success('Task deleted');
      navigate('/tasks');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="loading-screen"><div className="spinner spinner-page" /></div>
  );
  if (!task) return null;

  const isTerminal = task.status === 'success' || task.status === 'failed';

  return (
    <main className="main-content animate-fade-in">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
        <Link to="/tasks" style={{ color: 'var(--color-text-muted)' }}>Tasks</Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text-secondary)' }} className="truncate">{task.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>{task.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <StatusBadge status={task.status} />
            <span className="task-operation">{task.operation}</span>
            <span className="task-date">
              Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isTerminal && (
            <button
              onClick={handleDelete}
              className="btn btn-danger"
              disabled={deleting}
              id="delete-task-btn"
            >
              {deleting ? <span className="spinner spinner-sm" /> : '🗑 Delete'}
            </button>
          )}
          <Link to="/tasks/new" className="btn btn-primary">⚡ New Task</Link>
        </div>
      </div>

      {/* Timing info */}
      {(task.startedAt || task.completedAt || task.processingTimeMs) && (
        <div className="card mb-6" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {task.startedAt && (
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Started</div>
                <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
                  {format(new Date(task.startedAt), 'HH:mm:ss')}
                </div>
              </div>
            )}
            {task.completedAt && (
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</div>
                <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
                  {format(new Date(task.completedAt), 'HH:mm:ss')}
                </div>
              </div>
            )}
            {task.processingTimeMs && (
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--color-accent-soft)' }}>
                  {task.processingTimeMs}ms
                </div>
              </div>
            )}
            {task.workerVersion && (
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Worker</div>
                <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>v{task.workerVersion}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Input */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>📥 Input Text</h2>
          <div style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            lineHeight: 1.7,
            maxHeight: '260px',
            overflowY: 'auto',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {task.inputText}
          </div>
        </div>

        {/* Result */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>
            {task.status === 'success' ? '✅ Result' :
             task.status === 'failed'  ? '❌ Error' :
             task.status === 'running' ? '⚙️ Processing...' : '⏳ Waiting...'}
          </h2>
          {task.status === 'success' && task.result && (
            <ResultDisplay operation={task.operation} result={task.result} />
          )}
          {task.status === 'failed' && (
            <div style={{
              background: 'var(--color-error-bg)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              color: 'var(--color-error)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem'
            }}>
              {task.errorMessage || 'Unknown error occurred.'}
            </div>
          )}
          {(task.status === 'pending' || task.status === 'running') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text-muted)', padding: '16px 0' }}>
              <div className="spinner" style={{ borderTopColor: 'var(--color-primary-soft)' }} />
              <span>{task.status === 'running' ? 'Worker is processing your task...' : 'Waiting for an available worker...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: '1rem' }}>📋 Execution Logs</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {task.logs?.length ?? 0} entries
          </span>
        </div>
        <LogViewer logs={task.logs} />
      </div>
    </main>
  );
}
