import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import logo from '../assets/logo.png';
import './Login.css';

const AdminLogin = () => {
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
        if (data.user.role !== 'admin') {
          setError('Unauthorized. This portal is for Admins only.');
          return;
        }
        login(data.token, data.user.role);
        navigate('/admin');
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
        <div className="login-logo-container">
          <img src={logo} alt="AllDigi Logo" className="login-logo" />
        </div>
        <h2>Admin Portal</h2>
        <p className="login-subtitle">Sign in to manage company policies and analytics.</p>
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            className="input-field"
            placeholder="Admin Username"
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
            Log in to Dashboard
          </button>
        </form>
        <div className="login-footer">
          <button onClick={() => navigate('/employee/login')} className="btn-link">
            Are you an employee?
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
