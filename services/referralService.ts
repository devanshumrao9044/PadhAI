import { supabase } from '@/services/supabase';

const XP_REFEREE = 50;
const XP_REFERRER = 25;
const REWARD_THRESHOLD = 5;

// Called during signup after account is created
export async function applyReferralCode(
  refereeId: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  try {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { success: false, message: 'Invalid code.' };

    // Find referrer by code
    const { data: referrer, error } = await supabase
      .from('users')
      .select('id, my_referral_code')
      .eq('my_referral_code', trimmed)
      .maybeSingle();

    if (error || !referrer) {
      return { success: false, message: 'Referral code not found.' };
    }

    if (referrer.id === refereeId) {
      return { success: false, message: 'You cannot use your own referral code.' };
    }

    // Update referee's referred_by field
    await supabase
      .from('users')
      .update({ referred_by: trimmed })
      .eq('id', refereeId);

    // Create referral record
    await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referee_id: refereeId,
        status: 'pending',
      });

    return { success: true, message: 'Referral code applied!' };
  } catch {
    return { success: false, message: 'Could not apply referral code.' };
  }
}

// Called after user completes their FIRST focus session
export async function processReferralOnFirstSession(
  userId: string,
  awardXPFn: (amount: number, reason: string) => Promise<void>
): Promise<void> {
  try {
    // Check if user has a pending referral (was referred by someone)
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referee_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!referral) return;

    // Check this is truly their first completed session
    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('broken', false)
      .limit(2);

    if (!sessions || sessions.length !== 1) return;

    // Complete the referral
    await supabase
      .from('referrals')
      .update({
        status: 'completed',
        xp_awarded: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    // Award +50 XP to referee
    await awardXPFn(XP_REFEREE, 'referral_bonus_referee');

    // Award +25 XP to referrer
    const { data: referrerUser } = await supabase
      .from('users')
      .select('xp')
      .eq('id', referral.referrer_id)
      .single();

    if (referrerUser) {
      const newXP = (referrerUser.xp || 0) + XP_REFERRER;
      await supabase
        .from('users')
        .update({ xp: newXP })
        .eq('id', referral.referrer_id);

      await supabase
        .from('xp_transactions')
        .insert({
          user_id: referral.referrer_id,
          amount: XP_REFERRER,
          reason: 'referral_bonus_referrer',
        });
    }

    // Check if referrer now has 5 completed referrals
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
  } catch (err) {
    console.log('Referral process error:', err);
  }
}

// Fetch referral stats for referral screen
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

    const completed = referralsRes.data?.filter(r => r.status === 'completed').length ?? 0;
    const pending = referralsRes.data?.filter(r => r.status === 'pending').length ?? 0;

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
