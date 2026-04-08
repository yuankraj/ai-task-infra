import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <NavLink to="/dashboard" className="navbar-brand" style={{ textDecoration: 'none' }}>
          <div className="navbar-logo">⚡</div>
          <span>AI Task Platform</span>
        </NavLink>

        {/* Nav links */}
        <div className="navbar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Tasks
          </NavLink>
          <NavLink
            to="/tasks/new"
            className="btn btn-primary btn-sm"
            style={{ marginLeft: '8px' }}
          >
            + New Task
          </NavLink>
        </div>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="navbar-user">
            <div className="user-avatar">{initials}</div>
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            id="logout-btn"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
