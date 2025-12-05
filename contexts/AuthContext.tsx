
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

  useEffect(() => {
    let mounted = true;

    const fetchUserApiKey = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('gemini_api_key')
          .eq('user_id', userId)
          .single();
        
        if (mounted) {
          if (data) {
            setApiKey(data.gemini_api_key);
          } else {
            setApiKey(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch API key:', err);
      }
    };

    const initializeAuth = async () => {
      try {
        // 1. Get initial session (Supabase v2 syntax)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url
          };
          setUser(userData);
          await fetchUserApiKey(session.user.id);
        }
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Set up listener (Supabase v2 syntax)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url
          };
          setUser(userData);
          await fetchUserApiKey(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setApiKey(null);
      }
      
      setLoading(false);
    });

    // 3. Safety Timeout: Force loading to false after 5s if anything hangs
    const safetyTimeout = setTimeout(() => {
        if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // --- Auto-Logout on Inactivity Logic ---
  useEffect(() => {
    if (!user) return;

    // 30 minutes in milliseconds
    const INACTIVITY_LIMIT = 30 * 60 * 1000; 
    let timeoutId: any;

    const triggerLogout = () => {
      logout();
      if (document.visibilityState === 'visible') {
         alert("Session timed out due to inactivity.");
      }
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(triggerLogout, INACTIVITY_LIMIT);
    };

    // Events that count as activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];

    // Attach listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Start the timer
    resetTimer();

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);

  const login = async (email: string, password: string) => {
    setError(null);
    // Supabase v2 syntax
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, name: string) => {
    setError(null);
    // Supabase v2 syntax
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    setError(null);
    // Supabase v2 syntax
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) throw error;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Logout network error:", e);
    } finally {
      setUser(null);
      setApiKey(null);
    }
  };

  const saveApiKey = async (key: string) => {
    // Supabase v2 syntax: getUser is async
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

    if (userError || !currentUser) {
      console.error("Save API Key Error: No authenticated user found.");
      throw new Error("User not authenticated");
    }
    
    const { error } = await supabase
      .from('user_settings')
      .upsert({ 
        user_id: currentUser.id, 
        gemini_api_key: key,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error("Failed to save API Key to DB:", error);
      throw error;
    }
    
    setApiKey(key);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      apiKey, 
      login, 
      signUp,
      loginWithGoogle, 
      logout, 
      saveApiKey,
      isAuthenticated: !!user,
      loading,
      error
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
