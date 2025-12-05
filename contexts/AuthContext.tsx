import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  apiKey: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper: Fetch API Key
  const fetchApiKey = async (userId: string): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('gemini_api_key')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.gemini_api_key || null;
    } catch {
      return null;
    }
  };

  const mapUser = (sessionUser: any): User => ({
    id: sessionUser.id,
    email: sessionUser.email!,
    name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0],
    avatar_url: sessionUser.user_metadata?.avatar_url
  });

  useEffect(() => {
    let mounted = true;

    const runInitialization = async () => {
      try {
        // 1. Get Session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          // 2. Prepare User
          const currentUser = mapUser(session.user);
          setUser(currentUser);

          // 3. Get Key (Must await here to prevent modal flash)
          const key = await fetchApiKey(session.user.id);
          if (mounted) setApiKey(key);
        }
      } catch (e) {
        console.error("Initialization Error", e);
      } finally {
        // 4. Stop Loading
        // Only set this if we are still mounted. 
        // In Strict Mode, the first effect will unmount (mounted=false) preventing state update.
        // The second effect will run through and hit this line.
        if (mounted) setLoading(false);
      }
    };

    runInitialization();

    // 5. Listen for events (Updates state silently, doesn't block UI)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const currentUser = mapUser(session.user);
          setUser(currentUser);
          
          // Silent key refresh check
          if (!apiKey) {
             const key = await fetchApiKey(session.user.id);
             if (mounted) setApiKey(key);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setApiKey(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, name: string) => {
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) throw error;
  };

  const logout = async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
    setUser(null);
    setApiKey(null);
  };

  const saveApiKey = async (key: string) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error("No user.");

    const { error } = await supabase
      .from('user_settings')
      .upsert({ 
        user_id: currentUser.id, 
        gemini_api_key: key,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;
    setApiKey(key);
  };

  return (
    <AuthContext.Provider value={{ 
      user, apiKey, login, signUp, loginWithGoogle, logout, saveApiKey,
      isAuthenticated: !!user, loading, error
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};