import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const login = useStore(s => s.login);

  useEffect(() => {
    login();
    navigate('/dashboard', { replace: true });
  }, []);

  return null;
}
