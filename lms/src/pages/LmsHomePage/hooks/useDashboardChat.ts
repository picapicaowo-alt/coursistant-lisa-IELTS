import {useNavigate} from 'react-router-dom';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

/** The chat page consumes the existing session draft when the student opens it. */
export function useDashboardChat() {
  const navigate = useNavigate();
  return (message: string) => {
    if (message.trim()) {
      const stored = Number(localStorage.getItem('selectedCourseId') ?? 0);
      sessionStorage.setItem('pendingChat', JSON.stringify({text: message.trim(), courseId: Number.isFinite(stored) ? stored : 0}));
    }
    navigate(APP_ROUTE_PATHS.aibot);
  };
}
