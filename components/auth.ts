
import { supabase } from '../services/supabase'; // Services folder se Supabase connect karne ke liye

export const authService = {
  // 1. User Sign Up Helper
  async signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Agar signup successful ho, toh public users table mein profile sync karein
    if (data.user && name) {
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user.id,
            name: name,
            email: email,
            xp: 0,
            streak: 0,
          }
        ]);
      if (profileError) {
        console.error('Error creating user profile:', profileError);
      }
    }
    
    return data;
  },

  // 2. User Log In Helper
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // 3. User Log Out Helper
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // 4. Current Session Check
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }
};
