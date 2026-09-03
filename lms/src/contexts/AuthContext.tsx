import {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {V2ApiClient} from "@/apis";
import type {LoginResponse} from "@/apis";
import {authApiService} from "@/apis/services/auth-api";
import {normalizeAvatarUrl} from "@/utils/avatarUrl";
import {useQueryClient} from '@tanstack/react-query';

interface AuthContextValue {
  user: LoginResponse | null;
  login: (userData: LoginResponse) => void;
  logout: () => Promise<void>;
  updateProfile: (profile: {name?: string; avatar?: string | null}) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeUser = (user: LoginResponse): LoginResponse => ({
  ...user,
  avatar: normalizeAvatarUrl(user.avatar),
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({children}: AuthProviderProps) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const normalizedUser = normalizeUser(JSON.parse(storedUser));
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const clearRocketChatCookies = () => {
    const cookies = document.cookie.split(';');

    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();

      if (cookieName.startsWith('rc_') ||
        cookieName === 'rc_token' ||
        cookieName === 'rc_uid' ||
        cookieName === 'rc_room_type') {

        const domains = ['', '.xlearnedu.com', '.dev.chat.xlearnedu.com', 'dev.chat.xlearnedu.com'];
        const paths = ['/', '/home', '/api'];

        domains.forEach(domain => {
          paths.forEach(path => {
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}${domain ? `;domain=${domain}` : ''}`;
          });
        });
      }
    });
  };

  const login = (userData: LoginResponse) => {
    // Queries such as ['me'] are intentionally user-relative. Never carry a
    // previous identity's data or pending mutations into a new session.
    queryClient.clear();
    const normalizedUser = normalizeUser(userData);
    const storedUser = localStorage.getItem('user');
    let previousEmail: string | null = null;

    if (storedUser) {
      try {
        previousEmail = (JSON.parse(storedUser) as LoginResponse).email;
      } catch {
        localStorage.removeItem('user');
      }
    }

    const newEmail = userData.email;

    if (previousEmail && previousEmail !== newEmail) {
      clearRocketChatCookies();
    }

    // `account` belonged to the pre-v2 login implementation. Leaving it in
    // place can make LoginPage navigate using a stale user after switching
    // accounts, so a successful v2 session retires it permanently.
    localStorage.removeItem('account');
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  };

  const clearLocalSession = () => {
    queryClient.clear();
    V2ApiClient.clearAccessToken();
    localStorage.removeItem('accToken');
    localStorage.removeItem('account');
    localStorage.removeItem('user');
    setUser(null);
  };

  const logout = async () => {
    const rocketChatIframe = document.querySelector('iframe[title="RocketChat"]') as HTMLIFrameElement | null;
    const rocketChatOrigin = import.meta.env.VITE_ROCKETCHAT_BASE_URL;

    if (rocketChatIframe?.contentWindow && rocketChatOrigin) {
      try {
        rocketChatIframe.contentWindow.postMessage({
          event: 'call-api',
          method: 'logout'
        }, rocketChatOrigin);
      } catch {
        // Ignored
      }
    }

    try {
      // The refresh cookie identifies the server-side session. Calling this
      // endpoint before clearing local state prevents a logged-out browser
      // from silently obtaining another access token.
      await authApiService.logout();
    } catch (error) {
      // Local logout must still complete if the dev API is unavailable.
      if (import.meta.env.DEV) {
        console.warn('Server logout failed; local session was cleared', error);
      }
    } finally {
      clearRocketChatCookies();
      clearLocalSession();
      window.location.assign('/login');
    }
  };

  const updateProfile = (profile: {name?: string; avatar?: string | null}) => {
    setUser(current => {
      if (!current) return current;
      const updated = normalizeUser({
        ...current,
        name: profile.name ?? current.name,
        avatar: profile.avatar === undefined ? current.avatar : profile.avatar,
      });
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{user, login, logout, updateProfile, loading}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
