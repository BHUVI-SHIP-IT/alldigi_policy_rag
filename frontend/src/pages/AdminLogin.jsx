import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { AnimatedLoginPage } from '../components/ui/animated-login-page';

const AdminLogin = () => {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (username, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed.');
    }
    if (data.user.role !== 'admin') {
      throw new Error('Unauthorized. This portal is for Admins only.');
    }

    login(data.token, data.user.role);
    navigate('/admin');
  };

  return (
    <AnimatedLoginPage
      formTitle="Admin Portal"
      subtitle="Sign in to manage company policies and analytics."
      buttonLabel="Log in to Dashboard"
      accentHex="#5B21D4"
      tallCharColor="#FF4D4D"
      portalLabel="Admin Portal"
      footerLink={{
        label: 'Are you an employee? →',
        onClick: () => navigate('/employee/login'),
      }}
      onSubmit={handleSubmit}
    />
  );
};

export default AdminLogin;
