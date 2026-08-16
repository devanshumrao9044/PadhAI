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

// ── applyReferralCode: Validates and attaches a referral to a new user ─────────
export async function applyReferralCode(
  refereeId: string,
  code: string,
): Promise<boolean> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return false;

  try {
    const { data: referrerId, error: lookupError } = await supabase.rpc(
      'get_referrer_id',
      { code: normalizedCode },
    );

    if (lookupError || !referrerId || referrerId === refereeId) return false;

    const { data: existingReferral, error: existingError } = await supabase
      .from('referrals')
      .select('id')
      .eq('referee_id', refereeId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingReferral) return true;

    const { error: userError } = await supabase
      .from('users')
      .update({ referred_by: referrerId })
      .eq('id', refereeId);
    if (userError) throw userError;

    const { error: referralError } = await supabase.from('referrals').insert({
      referrer_id: referrerId,
      referee_id: refereeId,
      status: 'pending',
    });
    if (referralError) throw referralError;

    return true;
  } catch (err) {
    console.log('applyReferralCode error:', err);
    return false;
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
