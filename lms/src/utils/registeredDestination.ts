import {matchPath} from 'react-router-dom';
import {REGISTERED_ROUTE_PATTERNS} from '@/configs/routePaths';

/** Backend routes are hints: only registered, same-app destinations are navigable. */
export const registeredDestination = (value?: string | null): string | null => {
  if (!value || !value.startsWith('/') || /^\/[/\\]/.test(value) || /[\\\u0000-\u0020]/.test(value)) return null;
  const [pathname] = value.split(/[?#]/);
  const normalized = pathname.replace(/^\/courses\//, '/course/');
  return REGISTERED_ROUTE_PATTERNS.some(path => matchPath({path, end: true}, normalized))
    ? normalized + value.slice(pathname.length)
    : null;
};
