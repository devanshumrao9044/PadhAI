import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Share, Clipboard, ScrollView, ActivityIndicator,
  Linking, Modal, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { fetchReferralStats } from '@/services/referralService';

const REWARD_THRESHOLD = 5;
const INSTAGRAM_URL = 'https://www.instagram.com/materialhubx';
const EMAIL_ADDRESS = 'materialhubx@gmail.com';

export default function ReferralScreen() {
  const [loading, setLoading] = useState(true);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);
  const [hasUnlockedReward, setHasUnlockedReward] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReward, setShowReward] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const stats = await fetchReferralStats(user.id);
    setMyCode(stats.myCode);
    setCompleted(stats.completed);
    setPending(stats.pending);
    setHasUnlockedReward(stats.hasUnlockedReward);
    setLoading(false);
    if (stats.hasUnlockedReward) setShowReward(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCopy() {
    if (!myCode) return;
    Clipboard.setString(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!myCode) return;
    await Share.share({
      message: `Join PadhAI — the focus app for serious students! 🔥\n\nUse my referral code: ${myCode}\n\nSign up and complete your first focus session to earn +50 XP bonus!\n\nDownload: https://padhai.app`,
      title: 'Join PadhAI,Start your focused journey with my referral code',
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
    await Linking.openURL(
      `mailto:${EMAIL_ADDRESS}?subject=PadhAI Referral Reward Claim&body=Hi! I have completed 5 referrals on PadhAI. My referral code is ${myCode}. Please process my reward. Thank you!`
    );
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#7C5CFC" size="large" />
      </View>
    );
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
        <Text style={styles.headerTitle}>Refer & Earn</Text>
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
          <Text style={styles.heroTitle}>Invite friends. Earn XP and vouchers.</Text>
          <Text style={styles.heroSubtitle}>
            Share your code — you earn +25 XP for every friend who completes their first session.
          </Text>
        </View>

        {/* Referral Code Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>YOUR REFERRAL CODE</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{myCode ?? '——————'}</Text>
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnDone]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Text style={styles.copyBtnText}>
                {copied ? '✓ Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareBtnText}>Share Code →</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardLabel}>REFERRAL PROGRESS</Text>
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
              ? '🎉 Reward unlocked! Claim below.'
              : `${REWARD_THRESHOLD - completed} more referral${REWARD_THRESHOLD - completed === 1 ? '' : 's'} to unlock your reward.`
            }
          </Text>

          {pending > 0 ? (
            <Text style={styles.pendingText}>
              {pending} referral{pending > 1 ? 's' : ''} pending — friend hasn't completed first session yet.
            </Text>
          ) : null}
        </View>

        {/* Claim Reward */}
        {hasUnlockedReward ? (
          <View style={[styles.card, styles.rewardCard]}>
            <Text style={styles.rewardTitle}>🏆 Reward Unlocked!</Text>
            <Text style={styles.rewardSubtitle}>
              Contact us to claim your exclusive reward.
            </Text>
            <TouchableOpacity
              style={styles.claimBtn}
              onPress={claimViaInstagram}
              activeOpacity={0.8}
            >
              <Text style={styles.claimBtnText}>📸 Claim via Instagram</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.claimBtn, styles.claimBtnEmail]}
              onPress={claimViaEmail}
              activeOpacity={0.8}
            >
              <Text style={[styles.claimBtnText, styles.claimBtnEmailText]}>
                ✉️ Claim via Email
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* How it works */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>HOW IT WORKS</Text>
          {[
            { step: '1', text: 'Share your referral code with a friend.' },
            { step: '2', text: 'Friend signs up using your code.' },
            { step: '3', text: 'Friend completes their first focus session.' },
            { step: '4', text: 'You get +25 XP. Friend gets +50 XP.' },
            { step: '5', text: '5 successful referrals → Exclusive reward unlocked.' },
          ].map(item => (
            <View key={item.step} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{item.step}</Text>
              </View>
              <Text style={styles.stepText}>{item.text}</Text>
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
            <Text style={styles.modalTitle}>Reward Unlocked!</Text>
            <Text style={styles.modalSubtitle}>
              You've successfully referred 5 friends. Claim your exclusive reward now!
            </Text>
            <TouchableOpacity
              style={styles.modalInstagramBtn}
              onPress={() => { setShowReward(false); claimViaInstagram(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnText}>📸 Claim via Instagram</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalEmailBtn}
              onPress={() => { setShowReward(false); claimViaEmail(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalBtnText, { color: '#9CA3AF' }]}>
                ✉️ Claim via Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowReward(false)}>
              <Text style={styles.modalDismiss}>Claim later</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  loader: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backArrow: { color: '#7C5CFC', fontSize: 22, fontWeight: '700' },
  headerTitle: { color: '#F1F1F6', fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 16 },

  hero: { alignItems: 'center', paddingVertical: 12 },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  heroTitle: { color: '#F1F1F6', fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  heroSubtitle: { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  card: {
    backgroundColor: '#0F0F1A', borderRadius: 16,
    padding: 20, borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.12)',
  },
  cardLabel: {
    color: '#6B7280', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  codeText: { color: '#F1F1F6', fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  copyBtn: {
    backgroundColor: 'rgba(124, 92, 252, 0.15)', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(124, 92, 252, 0.3)',
  },
  copyBtnDone: { backgroundColor: 'rgba(46, 213, 115, 0.15)', borderColor: 'rgba(46, 213, 115, 0.3)' },
  copyBtnText: { color: '#7C5CFC', fontSize: 13, fontWeight: '700' },
  shareBtn: {
    backgroundColor: '#7C5CFC', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  shareBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressCount: { fontSize: 16 },
  progressDone: { color: '#7C5CFC', fontWeight: '900', fontSize: 20 },
  progressTotal: { color: '#6B7280', fontWeight: '600' },
  progressTrack: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4, overflow: 'hidden', marginVertical: 12,
  },
  progressFill: { height: '100%', backgroundColor: '#7C5CFC', borderRadius: 4 },
  progressHint: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  pendingText: { color: '#F59E0B', fontSize: 12, marginTop: 8 },

  rewardCard: { borderColor: 'rgba(253, 224, 71, 0.25)', backgroundColor: 'rgba(253, 224, 71, 0.04)' },
  rewardTitle: { color: '#FDE047', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  rewardSubtitle: { color: '#9CA3AF', fontSize: 13, marginBottom: 16 },
  claimBtn: {
    backgroundColor: '#7C5CFC', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 10,
  },
  claimBtnEmail: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  claimBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  claimBtnEmailText: { color: '#9CA3AF' },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(124, 92, 252, 0.2)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumber: { color: '#7C5CFC', fontSize: 12, fontWeight: '800' },
  stepText: { color: '#9CA3AF', fontSize: 13, lineHeight: 20, flex: 1 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#0F0F1A', borderRadius: 20,
    padding: 28, width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(253, 224, 71, 0.2)',
  },
  modalEmoji: { fontSize: 56, marginBottom: 16 },
  modalTitle: { color: '#FDE047', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  modalSubtitle: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalInstagramBtn: {
    backgroundColor: '#7C5CFC', borderRadius: 12,
    paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  modalEmailBtn: {
    backgroundColor: 'transparent', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 16,
  },
  modalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalDismiss: { color: '#4B5563', fontSize: 13 },
});
