
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lypsuxvthlklzrdbtudp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cHN1eHZ0aGxrbHpyZGJ0dWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4ODU2ODEsImV4cCI6MjA4MDQ2MTY4MX0.mgD84lm2QWzkkHYJJAygdXxCC0LOToogBDPVSDoo4Jw';

export const supabase = createClient(supabaseUrl, supabaseKey);
