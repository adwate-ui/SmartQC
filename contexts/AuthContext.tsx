
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  apiKey: string | null;
  login: (email: string, name: string) => void;
  loginWithGoogle: () => void;
  logout: () => void;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    // Check local storage for existing session
    const storedUser = localStorage.getItem('smartqc_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Try to get the API key associated with this user
      const storedKey = localStorage.getItem(`smartqc_apikey_${parsedUser.id}`);
      if (storedKey) {
        setApiKeyState(storedKey);
      }
    }
  }, []);

  const login = (email: string, name: string) => {
    // Simulate a simple login
    const newUser: User = {
      id: btoa(email), // Simple ID generation
      email,
      name,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`
    };
    localStorage.setItem('smartqc_user', JSON.stringify(newUser));
    setUser(newUser);
    
    // Check for existing key
    const storedKey = localStorage.getItem(`smartqc_apikey_${newUser.id}`);
    setApiKeyState(storedKey || null);
  };

  const loginWithGoogle = () => {
    // Simulate Google Login
    const newUser: User = {
      id: 'google_user_123',
      email: 'user@gmail.com',
      name: 'Google User',
      avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
    };
    localStorage.setItem('smartqc_user', JSON.stringify(newUser));
    setUser(newUser);
    
    const storedKey = localStorage.getItem(`smartqc_apikey_${newUser.id}`);
    setApiKeyState(storedKey || null);
  };

  const logout = () => {
    localStorage.removeItem('smartqc_user');
    setUser(null);
    setApiKeyState(null);
  };

  const setApiKey = (key: string) => {
    if (user) {
      localStorage.setItem(`smartqc_apikey_${user.id}`, key);
      setApiKeyState(key);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      apiKey, 
      login, 
      loginWithGoogle, 
      logout, 
      setApiKey,
      isAuthenticated: !!user 
    }}>
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
