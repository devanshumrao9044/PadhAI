import { supabase } from '@/services/supabase';

const XP_REFEREE = 50;
const XP_REFERRER = 25;
const REWARD_THRESHOLD = 5;

// ── processReferralOnFirstSession: Awards XP on first successful focus session ──
export async function processReferralOnFirstSession(
  userId: string
): Promise<void> {
  try {
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, referrer_id, status')
      .eq('referee_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!referral) return;

    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('broken', false)
      .limit(2);

    // The handler may run immediately after the insert or during offline sync.
    // Any completed session proves the user has reached the referral milestone;
    // the pending referral filter below keeps the operation idempotent.
    if (!sessions || sessions.length === 0) return;

    const { data: completedReferral, error: completionError } = await supabase
      .from('referrals')
      .update({ status: 'completed' })
      .eq('id', referral.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (completionError) throw completionError;
    // Only the caller that successfully transitions pending -> completed may
    // award XP; concurrent retries exit here without duplicating the reward.
    if (!completedReferral) return;

    const { data: referee } = await supabase
      .from('users')
      .select('xp')
      .eq('id', userId)
      .single();

    if (referee) {
      await supabase
        .from('users')
        .update({ xp: (referee.xp || 0) + XP_REFEREE })
        .eq('id', userId);

      await supabase.from('xp_transactions').insert({
        user_id: userId,
        amount: XP_REFEREE,
        reason: 'referral_bonus_referee',
      });
    }

    const { data: referrer } = await supabase
      .from('users')
      .select('xp')
      .eq('id', referral.referrer_id)
      .single();

    if (referrer) {
      await supabase
        .from('users')
        .update({ xp: (referrer.xp || 0) + XP_REFERRER })
        .eq('id', referral.referrer_id);

      await supabase.from('xp_transactions').insert({
        user_id: referral.referrer_id,
        amount: XP_REFERRER,
        reason: 'referral_bonus_referrer',
      });
    }

    const { count } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referral.referrer_id)
      .eq('status', 'completed');

    if ((count ?? 0) >= REWARD_THRESHOLD) {
      await supabase
        .from('users')
        .update({ has_unlocked_reward: true })
        .eq('id', referral.referrer_id);
    }

    console.log(`Referral done: +${XP_REFEREE} to referee, +${XP_REFERRER} to referrer`);
  } catch (err) {
    console.log('processReferralOnFirstSession error:', err);
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
