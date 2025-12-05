
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

  // Helper: Get API Key
  const fetchApiKey = async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('gemini_api_key')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // code PGRST116 means 0 rows found, which is expected for new users
        if (error.code !== 'PGRST116') {
          console.error("DB Error fetching API Key:", error);
        }
        return null;
      }
      return data?.gemini_api_key || null;
    } catch (e) {
      console.error("Exception fetching API Key:", e);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Get Session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          // 2. Set User
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url
          };
          setUser(userData);

          // 3. Fetch Key (Blocking)
          const key = await fetchApiKey(session.user.id);
          if (mounted) setApiKey(key);
        }
      } catch (e) {
        console.error("Auth init failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // 4. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN') {
        // Force loading true while we resolve the user profile and key
        setLoading(true);
        if (session?.user) {
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url
          };
          setUser(userData);
          const key = await fetchApiKey(session.user.id);
          setApiKey(key);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setApiKey(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- Auto-Logout ---
  useEffect(() => {
    if (!user) return;
    const INACTIVITY_LIMIT = 30 * 60 * 1000; 
    let timeoutId: any;

    const triggerLogout = () => {
      logout();
      // Only alert if page is visible
      if (document.visibilityState === 'visible') {
         // Using console warn instead of alert to be less intrusive on wake
         console.warn("Session timed out due to inactivity.");
      }
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(triggerLogout, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

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
    try {
      await supabase.auth.signOut();
    } catch (e) { console.warn(e); }
    setUser(null);
    setApiKey(null);
  };

  const saveApiKey = async (key: string) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error("No authenticated user.");

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
