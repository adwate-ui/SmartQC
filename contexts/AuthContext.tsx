import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

  // Track the currently loaded user ID to prevent redundant re-fetches
  const loadedUserId = useRef<string | null>(null);

  const mapUser = (sessionUser: any): User => ({
    id: sessionUser.id,
    email: sessionUser.email!,
    name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0],
    avatar_url: sessionUser.user_metadata?.avatar_url
  });

  const loadSessionData = async (sessionUser: any) => {
    // If we've already loaded this user, skip to avoid flicker
    if (loadedUserId.current === sessionUser.id && apiKey !== null) return;
    
    loadedUserId.current = sessionUser.id;

    try {
      // 1. Fetch API Key
      const { data, error } = await supabase
        .from('user_settings')
        .select('gemini_api_key')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn("Error fetching API Key:", error);
      }

      // 2. Set State Batch
      setUser(mapUser(sessionUser));
      setApiKey(data?.gemini_api_key || null);
    } catch (e) {
      console.error("Auth load error:", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user && mounted) {
          // 2. Load data strictly before stopping loading
          await loadSessionData(session.user);
        }
      } catch (e) {
        console.error("Auth init exception:", e);
      } finally {
        // 3. Always unblock UI
        if (mounted) setLoading(false);
      }
    };

    init();

    // 4. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') return; // Handled by init()

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          // If we switched users, or came from a clean state
          if (session.user.id !== loadedUserId.current) {
             setLoading(true);
             await loadSessionData(session.user);
             setLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        loadedUserId.current = null;
        setUser(null);
        setApiKey(null);
        setLoading(false);
      }
    });
    
    // Safety Fallback: Ensure we never get stuck on loading
    const timeout = setTimeout(() => {
        if (mounted && loading) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Inactivity Timer
  useEffect(() => {
    if (!user) return;
    const INACTIVITY_LIMIT = 30 * 60 * 1000; 
    let timeoutId: any;

    const doLogout = () => {
       supabase.auth.signOut().then(() => {
         setUser(null);
         setApiKey(null);
       });
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(doLogout, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
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
    await supabase.auth.signOut();
    loadedUserId.current = null;
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