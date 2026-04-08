import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome, ${data.user.username}! Account created.`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errors) {
        const fieldErrors = {};
        errData.errors.forEach((e) => { fieldErrors[e.path] = e.msg; });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: errData?.error || 'Registration failed.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-slide-up">
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Start processing AI tasks today</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} id="register-form">
          {errors.general && (
            <div style={{
              background: 'var(--color-error-bg)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              color: 'var(--color-error)',
              fontSize: '0.875rem'
            }}>
              ⚠ {errors.general}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="reg-username">Username</label>
            <input
              id="reg-username"
              name="username"
              type="text"
              className="form-input"
              placeholder="cooldev42"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
            {errors.username && <span className="form-error">⚠ {errors.username}</span>}
            <span className="form-hint">3–30 chars, letters/numbers/underscore</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
            {errors.email && <span className="form-error">⚠ {errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              name="password"
              type="password"
              className="form-input"
              placeholder="Min 8 chars, upper + lower + number"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            {errors.password && <span className="form-error">⚠ {errors.password}</span>}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            id="register-submit"
            disabled={loading}
          >
            {loading ? <><span className="spinner spinner-sm" /> Creating account...</> : 'Create Account'}
          </button>
        </form>

        <p className="auth-divider">
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary-soft)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
