import { supabase } from '@/services/supabase';

const XP_REFEREE = 50;
const XP_REFERRER = 25;
const REWARD_THRESHOLD = 5;

// ── Apply referral code during signup ─────────────────────────────────────────
export async function applyReferralCode(
  refereeId: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  try {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { success: false, message: 'Invalid code.' };

    const { data: referrer } = await supabase
      .from('users')
      .select('id, my_referral_code')
      .eq('my_referral_code', trimmed)
      .maybeSingle();

    if (!referrer) {
      return { success: false, message: 'Referral code not found.' };
    }

    if (referrer.id === refereeId) {
      return { success: false, message: 'You cannot use your own referral code.' };
    }

    await supabase
      .from('users')
      .update({ referred_by: trimmed })
      .eq('id', refereeId);

    const { error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referee_id: refereeId,
        status: 'pending',
      });

    if (error) {
      console.log('Referral insert error:', error.message);
      return { success: false, message: 'Could not apply referral code.' };
    }

    return { success: true, message: 'Referral code applied! You will earn +50 XP after your first session.' };
  } catch (err) {
    console.log('applyReferralCode error:', err);
    return { success: false, message: 'Could not apply referral code.' };
  }
}

// ── Process referral after first completed session ────────────────────────────
// Self-contained — no external XP function needed
export async function processReferralOnFirstSession(userId: string): Promise<void> {
  try {
    // 1. Check if this user was referred (pending referral exists)
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, referrer_id, status')
      .eq('referee_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!referral) return; // Not referred or already processed

    // 2. Confirm this is truly their FIRST completed session
    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('broken', false)
      .limit(2);

    // Must have exactly 1 completed session (the one just finished)
    if (!sessions || sessions.length !== 1) return;

    // 3. Mark referral as completed
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'completed',
        xp_awarded: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    if (updateError) {
      console.log('Referral update error:', updateError.message);
      return;
    }

    // 4. Award +50 XP to referee (the new user who just completed first session)
    const { data: refereeData } = await supabase
      .from('users')
      .select('xp')
      .eq('id', userId)
      .single();

    if (refereeData) {
      await supabase
        .from('users')
        .update({ xp: (refereeData.xp || 0) + XP_REFEREE })
        .eq('id', userId);

      await supabase.from('xp_transactions').insert({
        user_id: userId,
        amount: XP_REFEREE,
        reason: 'referral_bonus_referee',
      });
    }

    // 5. Award +25 XP to referrer
    const { data: referrerData } = await supabase
      .from('users')
      .select('xp')
      .eq('id', referral.referrer_id)
      .single();

    if (referrerData) {
      await supabase
        .from('users')
        .update({ xp: (referrerData.xp || 0) + XP_REFERRER })
        .eq('id', referral.referrer_id);

      await supabase.from('xp_transactions').insert({
        user_id: referral.referrer_id,
        amount: XP_REFERRER,
        reason: 'referral_bonus_referrer',
      });
    }

    // 6. Check if referrer now has 5 completed referrals → unlock reward
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

    console.log(`Referral processed: +${XP_REFEREE} XP to referee, +${XP_REFERRER} XP to referrer`);
  } catch (err) {
    console.log('processReferralOnFirstSession error:', err);
  }
}

// ── Fetch referral stats for referral screen ──────────────────────────────────
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
