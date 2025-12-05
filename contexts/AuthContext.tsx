
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

  // Initial Session Check & Subscription
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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
      } catch (err: any) {
        console.error('Error fetching session:', err);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url
        };
        setUser(userData);
        await fetchUserApiKey(session.user.id);
      } else {
        setUser(null);
        setApiKey(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Auto-Logout on Inactivity Logic ---
  useEffect(() => {
    if (!user) return;

    // 30 minutes in milliseconds
    const INACTIVITY_LIMIT = 30 * 60 * 1000; 
    let timeoutId: any;

    const triggerLogout = () => {
      logout();
      alert("Session timed out due to inactivity.");
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
  }, [user]); // Re-run effect when user login state changes

  const fetchUserApiKey = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('gemini_api_key')
        .eq('user_id', userId)
        .single();
      
      if (data) {
        setApiKey(data.gemini_api_key);
      } else if (!error || error.code === 'PGRST116') {
        // No row exists, or error meant not found
        setApiKey(null);
      }
    } catch (err) {
      console.error('Failed to fetch API key:', err);
    }
  };

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
      options: {
        data: { name }
      }
    });
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setApiKey(null);
  };

  const saveApiKey = async (key: string) => {
    // 1. Get the current user directly from Supabase to ensure no state staleness
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

    if (userError || !currentUser) {
      console.error("Save API Key Error: No authenticated user found.");
      throw new Error("User not authenticated");
    }
    
    // 2. Upsert the API Key into user_settings table
    const { error } = await supabase
      .from('user_settings')
      .upsert({ 
        user_id: currentUser.id, 
        gemini_api_key: key,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.error("Failed to save API Key to DB:", error);
      throw error;
    }
    
    // 3. Update local state only after successful DB write
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
