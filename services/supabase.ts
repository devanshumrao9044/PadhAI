import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sligrtvwosldwhlnfyen.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsaWdydHZ3b3NsZHdobG5meWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjUyNjIsImV4cCI6MjA5NTMwMTI2Mn0.gH8H30cArEnqKu9v8a_2CM3uTcm6ZEUI3D8CiqbNxCE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
