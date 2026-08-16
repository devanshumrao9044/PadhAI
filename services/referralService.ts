import { supabase } from '@/services/supabase';

const XP_REFEREE = 50;
const XP_REFERRER = 25;
const REWARD_THRESHOLD = 5;

// ── processReferralOnFirstSession: Awards XP on first successful focus session ──
export async function processReferralOnFirstSession(
  userId: string
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('process_referral_bonus', {
      p_referee_id: userId,
    });
    if (error) throw error;
    if (data?.success) {
      console.log(`[Referral] Success: +${data.referee_xp_added} XP to referee, +${data.referrer_xp_added} XP to referrer`);
    }
  } catch (err) {
    console.log('[Referral] processReferralOnFirstSession error:', err);
  }
}

// ── fetchReferralStats: Retrieves referral counts and code for the user ────────
export async function fetchReferralStats(userId: string): Promise<{
  myCode: string | null;
  completed: number;
  pending: number;
  hasUnlockedReward: boolean;
}> {
  try {
    const [userRes, referralsRes] = await Promise.all([
      supabase
        .from('users')
        .select('my_referral_code, has_unlocked_reward')
        .eq('id', userId)
        .single(),
      supabase
        .from('referrals')
        .select('status')
        .eq('referrer_id', userId),
    ]);

    const completed =
      referralsRes.data?.filter(r => r.status === 'completed').length ?? 0;
    const pending =
      referralsRes.data?.filter(r => r.status === 'pending').length ?? 0;

    return {
      myCode: userRes.data?.my_referral_code ?? null,
      completed,
      pending,
      hasUnlockedReward: userRes.data?.has_unlocked_reward ?? false,
    };
  } catch {
    return { myCode: null, completed: 0, pending: 0, hasUnlockedReward: false };
  }
}
