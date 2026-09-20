import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

import api from '@/lib/axios';
import { markGettingStartedWindow } from '@/lib/onboarding';

interface User {
  id: string;
  username: string;
  email?: string;
}

interface SignupData {
  firstname: string;
  lastname: string;
  username: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (data: SignupData) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const dispatchThemeSync = () => {
    window.dispatchEvent(new CustomEvent('themeSync'));
  };

  const applyUserFromMe = (userData: { id?: string | number; username?: string; email?: string; theme?: string }, fallbackUsername?: string) => {
    setUser({
      id: String(userData.id || '1'),
      username: userData.username || fallbackUsername || '',
      email: userData.email,
    });

    if (userData.theme) {
      document.documentElement.classList.toggle('dark', userData.theme === 'dark');
      dispatchThemeSync();
    }
  };

  const checkAuth = async () => {
    try {
      const token = sessionStorage.getItem('access_token');
      
      if (!token) {
        try {
          const refreshResponse = await api.post('/login/refresh');
          const { access_token } = refreshResponse.data;
          sessionStorage.setItem('access_token', access_token);
        } catch {
          setUser(null);
          setIsLoading(false);
          return;
        }
      }

      try {
        const response = await api.get('/user/me');
        
        if (response.data && response.data.user) {
          applyUserFromMe(response.data.user);
        } else if (response.data && response.data.username) {
          applyUserFromMe(response.data);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed after attempts:', error);
        setUser(null);
        sessionStorage.removeItem('access_token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      sessionStorage.removeItem('access_token');
    } finally {
      setIsLoading(false);
    }
  };

  const establishSession = async (accessToken: string, fallbackUsername?: string): Promise<boolean> => {
    sessionStorage.setItem('access_token', accessToken);

    try {
      const userResponse = await api.get('/user/me');
      applyUserFromMe(userResponse.data, fallbackUsername);
      return true;
    } catch (userError) {
      console.error('Failed to fetch user data:', userError);
      setUser({
        id: '1',
        username: fallbackUsername || '',
      });
      return true;
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      if (username && password) {
        const formData = new URLSearchParams();     
        formData.append('username', username);
        formData.append('password', password);

        const response = await api.post('/login/', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'accept': 'application/json'
          },
          withCredentials: true
        });

        if (response.data.access_token) {
          const ok = await establishSession(response.data.access_token, username);
          if (ok) markGettingStartedWindow();
          return ok;
        }
        return false;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await api.post('/signup/', data, {
        withCredentials: true
      });

      if (response.data.access_token) {
        const ok = await establishSession(response.data.access_token, data.username);
        if (ok) markGettingStartedWindow();
        return ok;
      }
      return false;
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout/', {});
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      sessionStorage.removeItem('access_token');
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
