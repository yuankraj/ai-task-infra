import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';

const OPERATIONS = [
  { value: 'uppercase', label: 'Uppercase', desc: 'Convert all text to UPPERCASE', icon: '🔠' },
  { value: 'lowercase', label: 'Lowercase', desc: 'Convert all text to lowercase', icon: '🔡' },
  { value: 'reverse',   label: 'Reverse',   desc: 'Reverse the entire string',     icon: '🔄' },
  { value: 'word_count', label: 'Word Count', desc: 'Count words, chars & sentences', icon: '📊' }
];

export default function NewTaskPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', inputText: '', operation: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.inputText.trim()) errs.inputText = 'Input text is required';
    if (!form.operation) errs.operation = 'Please select an operation';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data } = await api.post('/tasks', form);
      toast.success('Task created and queued!');
      navigate(`/tasks/${data.task.id}`);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errors) {
        const fieldErrors = {};
        errData.errors.forEach((e) => { fieldErrors[e.path] = e.msg; });
        setErrors(fieldErrors);
      } else {
        toast.error(errData?.error || 'Failed to create task');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="main-content animate-fade-in">
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div className="mb-6">
          <h1>New Task</h1>
          <p style={{ marginTop: '4px' }}>Configure and submit a text processing task.</p>
        </div>

        <form onSubmit={handleSubmit} id="new-task-form">
          {/* Title */}
          <div className="card mb-6">
            <h2 style={{ fontSize: '1rem', marginBottom: '20px' }}>Task Details</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="task-title">Task Title</label>
              <input
                id="task-title"
                name="title"
                type="text"
                className="form-input"
                placeholder="e.g. Process customer feedback"
                value={form.title}
                onChange={handleChange}
                maxLength={200}
              />
              {errors.title && <span className="form-error">⚠ {errors.title}</span>}
            </div>
          </div>

          {/* Operation picker */}
          <div className="card mb-6">
            <h2 style={{ fontSize: '1rem', marginBottom: '20px' }}>Select Operation</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {OPERATIONS.map((op) => (
                <label
                  key={op.value}
                  htmlFor={`op-${op.value}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${form.operation === op.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: form.operation === op.value ? 'var(--color-primary-bg)' : 'var(--color-surface-2)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <input
                    type="radio"
                    id={`op-${op.value}`}
                    name="operation"
                    value={op.value}
                    checked={form.operation === op.value}
                    onChange={handleChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>{op.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: form.operation === op.value ? 'var(--color-primary-soft)' : 'var(--color-text-primary)' }}>
                      {op.label}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {op.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {errors.operation && <span className="form-error mt-4">⚠ {errors.operation}</span>}
          </div>

          {/* Input text */}
          <div className="card mb-6">
            <h2 style={{ fontSize: '1rem', marginBottom: '20px' }}>Input Text</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="task-input">Text to Process</label>
              <textarea
                id="task-input"
                name="inputText"
                className="form-textarea"
                placeholder="Paste or type the text you want to process..."
                value={form.inputText}
                onChange={handleChange}
                rows={8}
                maxLength={10000}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {errors.inputText
                  ? <span className="form-error">⚠ {errors.inputText}</span>
                  : <span />}
                <span className="form-hint">{form.inputText.length}/10,000</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              id="submit-task-btn"
              disabled={loading}
            >
              {loading
                ? <><span className="spinner spinner-sm" /> Submitting...</>
                : '⚡ Run Task'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              onClick={() => navigate('/tasks')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
