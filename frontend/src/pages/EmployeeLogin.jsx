import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import './Login.css';

const EmployeeLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      
      if (response.ok) {
        if (data.user.role !== 'employee') {
          setError('Unauthorized. This portal is for Employees only.');
          return;
        }
        login(data.token, data.user.role);
        navigate('/chat');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to login. Server might be down.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Welcome Back</h2>
        <p className="login-subtitle">Sign in to talk to your AI assistant.</p>
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            className="input-field"
            placeholder="Employee Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="input-field"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
            Continue
          </button>
        </form>
        <div className="login-footer">
          <button onClick={() => navigate('/admin/login')} className="btn-link">
            Are you an admin?
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
