import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { AnimatedLoginPage } from '../components/ui/animated-login-page';

const EmployeeLogin = () => {
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
    if (data.user.role !== 'employee') {
      throw new Error('Unauthorized. This portal is for Employees only.');
    }

    login(data.token, data.user.role);
    navigate('/chat');
  };

  return (
    <AnimatedLoginPage
      formTitle="Welcome Back!"
      subtitle="Sign in to talk to your AI assistant."
      buttonLabel="Continue"
      accentHex="#10a37f"
      tallCharColor="#6C3FF5"
      portalLabel="Employee Portal"
      footerLink={{
        label: 'Are you an admin? →',
        onClick: () => navigate('/admin/login'),
      }}
      onSubmit={handleSubmit}
    />
  );
};

export default EmployeeLogin;
