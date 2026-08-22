import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ReferralSkeleton } from '@/components/ui/Skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Share, ScrollView,
  Linking, Modal, Pressable
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/features/core/services/supabase';
import { fetchReferralStats } from '@/features/referrals/services/referralService';

const REWARD_THRESHOLD = 5;
const INSTAGRAM_URL = 'https://www.instagram.com/materialhubx';
const EMAIL_ADDRESS = 'materialhubx@gmail.com';

export default function ReferralScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);
  const [hasUnlockedReward, setHasUnlockedReward] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const mountedRef = useRef(true);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // ✅ Fix: stop the spinner even when there's no user yet —
      // previously this left `loading: true` forever, showing an infinite spinner
      setLoading(false);
      return;
    }
    const stats = await fetchReferralStats(user.id);
    if (!mountedRef.current) return;
    setMyCode(stats.myCode?.toUpperCase() ?? null);
    setCompleted(stats.completed);
    setPending(stats.pending);
    setHasUnlockedReward(stats.hasUnlockedReward);
    setLoading(false);

    if (stats.hasUnlockedReward) {
      const { data: userData } = await supabase
        .from('users')
        .select('reward_popup_seen')
        .eq('id', user.id)
        .single();

      if (!mountedRef.current) return;
      if (!userData?.reward_popup_seen) {
        setShowReward(true);
        await supabase.rpc('mark_reward_popup_seen');
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Using expo-clipboard with async function
  async function handleCopy() {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  }

  async function handleShare() {
    if (!myCode) return;
    await Share.share({
      message: t('referral.shareMessage', { code: myCode }),
      title: t('referral.shareTitle'),
    });
  }

  async function claimViaInstagram() {
    const canOpen = await Linking.canOpenURL(INSTAGRAM_URL);
    if (canOpen) {
      await Linking.openURL(INSTAGRAM_URL);
    } else {
      await Linking.openURL(`https://instagram.com/materialhubx`);
    }
  }

  async function claimViaEmail() {
    const code = myCode;
    if (!code) return;
    await Linking.openURL(
      `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(t('referral.emailSubject'))}&body=${encodeURIComponent(t('referral.emailBody', { code }))}`
    );
  }

  if (loading) {
    return <ReferralSkeleton />;
  }

  const progress = Math.min(completed / REWARD_THRESHOLD, 1);
  const progressWidth = `${Math.round(progress * 100)}%` as any;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('referral.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🎁</Text>
          <Text style={styles.heroTitle}>{t('referral.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('referral.heroSubtitle')}</Text>
        </View>

        {/* Referral Code Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('referral.codeLabel')}</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{myCode ?? '——————'}</Text>
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnDone]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Text style={styles.copyBtnText}>
                {copied ? t('referral.copied') : t('referral.copy')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
          >
              <Text style={styles.shareBtnText}>{t('referral.share')}</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardLabel}>{t('referral.progress')}</Text>
            <Text style={styles.progressCount}>
              <Text style={styles.progressDone}>{completed}</Text>
              <Text style={styles.progressTotal}> / {REWARD_THRESHOLD}</Text>
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <Text style={styles.progressHint}>
            {completed >= REWARD_THRESHOLD
              ? t('referral.rewardUnlockedHint')
              : REWARD_THRESHOLD - completed === 1
              ? t('referral.oneMoreReferral')
              : t('referral.moreReferrals', { value: REWARD_THRESHOLD - completed })
            }
          </Text>

          {pending > 0 ? (
            <Text style={styles.pendingText}>
              {pending === 1 ? t('referral.onePending') : t('referral.pending', { value: pending })}
            </Text>
          ) : null}
        </View>

        {/* Claim Reward */}
        {hasUnlockedReward ? (
          <View style={[styles.card, styles.rewardCard]}>
            <Text style={styles.rewardTitle}>{t('referral.rewardTitle')}</Text>
            <Text style={styles.rewardSubtitle}>{t('referral.rewardSubtitle')}</Text>
            <TouchableOpacity
              style={styles.claimBtn}
              onPress={claimViaInstagram}
              activeOpacity={0.8}
            >
              <Text style={styles.claimBtnText}>{t('referral.claimInstagram')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.claimBtn, styles.claimBtnEmail]}
              onPress={claimViaEmail}
              activeOpacity={0.8}
            >
              <Text style={[styles.claimBtnText, styles.claimBtnEmailText]}>
                {t('referral.claimEmail')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* How it works */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('referral.howItWorks')}</Text>
          {[
            { step: '1', text: t('referral.step1') },
            { step: '2', text: t('referral.step2') },
            { step: '3', text: t('referral.step3') },
            { step: '4', text: t('referral.step4') },
            { step: '5', text: t('referral.step5') },
          ].map(item => (
            <View key={item.step} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{item.step}</Text>
              </View>
              <Text style={styles.stepText} allowFontScaling>{item.text}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Reward Popup Modal */}
      <Modal
        visible={showReward}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReward(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowReward(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalEmoji}>🏆</Text>
            <Text style={styles.modalTitle}>{t('referral.rewardTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('referral.modalSubtitle')}</Text>
            <TouchableOpacity
              style={styles.modalInstagramBtn}
              onPress={() => { setShowReward(false); claimViaInstagram(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnText}>{t('referral.claimInstagram')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalEmailBtn}
              onPress={() => { setShowReward(false); claimViaEmail(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                {t('referral.claimEmail')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowReward(false)}>
              <Text style={styles.modalDismiss}>{t('referral.claimLater')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backArrow: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 16 },

  hero: { alignItems: 'center', paddingVertical: 12 },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  heroTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  heroSubtitle: { color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 20, borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '800',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  codeText: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: 2, includeFontPadding: false },
  copyBtn: {
    backgroundColor: colors.primaryDim + '66', borderRadius: 8,
    minWidth: 72, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.primary + '88',
    alignItems: 'center',
  },
  copyBtnDone: { backgroundColor: colors.success + '22', borderColor: colors.success + '88' },
  copyBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  shareBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  shareBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressCount: { fontSize: 16 },
  progressDone: { color: colors.primary, fontWeight: '900', fontSize: 20 },
  progressTotal: { color: colors.textTertiary, fontWeight: '600' },
  progressTrack: {
    height: 8, backgroundColor: colors.surfaceVariant,
    borderRadius: 4, overflow: 'hidden', marginVertical: 12,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  progressHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  pendingText: { color: colors.warning, fontSize: 12, marginTop: 8 },

  rewardCard: { borderColor: colors.warning + '66', backgroundColor: colors.warning + '12' },
  rewardTitle: { color: colors.warning, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  rewardSubtitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  claimBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 10,
  },
  claimBtnEmail: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
  claimBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  claimBtnEmailText: { color: colors.textSecondary },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14, minWidth: 0 },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primaryDim + '88',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumber: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  stepText: { flex: 1, minWidth: 0, color: colors.textSecondary, fontSize: 14, lineHeight: 21 },

  modalOverlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: 20,
    padding: 28, width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: colors.warning + '55',
  },
  modalEmoji: { fontSize: 56, marginBottom: 16 },
  modalTitle: { color: colors.warning, fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  modalInstagramBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  modalEmailBtn: {
    backgroundColor: 'transparent', borderRadius: 12, borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 16,
  },
  modalBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  modalDismiss: { color: colors.textTertiary, fontSize: 13 },
});
