/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

// Use Vite environment variables if available, otherwise fall back to the provided keys.
// In Netlify, you should set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in "Site settings > Environment variables".
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lypsuxvthlklzrdbtudp.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cHN1eHZ0aGxrbHpyZGJ0dWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4ODU2ODEsImV4cCI6MjA4MDQ2MTY4MX0.mgD84lm2QWzkkHYJJAygdXxCC0LOToogBDPVSDoo4Jw';

export const supabase = createClient(supabaseUrl, supabaseKey);