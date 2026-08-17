import { supabase } from '@/services/supabase';

const XP_REFEREE = 50;
const XP_REFERRER = 25;
const REWARD_THRESHOLD = 5;

// ── processReferralOnFirstSession: Awards XP on first successful focus session ──
export type ReferralBonusResult = {
  success: boolean;
  refereeXpAdded: number;
  referrerXpAdded: number;
  referrerTotalCompleted: number;
};

export async function processReferralOnFirstSession(
  userId: string
): Promise<ReferralBonusResult | null> {
  try {
    const { data, error } = await supabase.rpc('process_referral_bonus', {
      p_referee_id: userId,
    });
    if (error) throw error;
    if (data?.success) {
      const result: ReferralBonusResult = {
        success: true,
        refereeXpAdded: Number(data.referee_xp_added ?? 0),
        referrerXpAdded: Number(data.referrer_xp_added ?? 0),
        referrerTotalCompleted: Number(data.referrer_total_completed ?? 0),
      };
      console.log(`[Referral] Success: +${result.refereeXpAdded} XP to referee, +${result.referrerXpAdded} XP to referrer`);
      return result;
    }
  } catch (err) {
    console.log('[Referral] processReferralOnFirstSession error:', err);
  }
  return null;
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
