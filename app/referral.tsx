import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share,
  Linking, Animated, Pressable, Modal, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { supabase } from '@/services/supabase';

const ADMIN_INSTAGRAM = 'ziddistudent'; // Change to real handle
const ADMIN_EMAIL = 'admin@ziddistudent.com'; // Change to real email
const MAX_REFERRALS = 5;

function ProgressBar({ current, max }: { current: number; max: number }) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const progress = Math.min(current / max, 1);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const segmentWidth = `${(1 / max) * 100}%` as any;

  return (
    <View>
      {/* Segmented track */}
      <View style={pb.track}>
        {Array.from({ length: max }).map((_, i) => {
          const filled = i < current;
          return (
            <View
              key={i}
              style={[
                pb.segment,
                { width: segmentWidth },
                filled ? pb.segmentFilled : pb.segmentEmpty,
              ]}
            >
              {filled ? (
                <View style={pb.segmentCheck}>
                  <MaterialIcons name="check" size={12} color="#fff" />
                </View>
              ) : (
                <Text style={pb.segmentNum}>{i + 1}</Text>
              )}
            </View>
          );
        })}
      </View>
      <View style={pb.labelRow}>
        <Text style={pb.labelLeft}>{current} / {max} successful referrals</Text>
        <Text style={pb.labelRight}>
          {max - current > 0 ? `${max - current} more for jackpot!` : '🎉 Jackpot unlocked!'}
        </Text>
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  track: { flexDirection: 'row', gap: 6 },
  segment: {
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  segmentFilled: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentEmpty: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentCheck: {},
  segmentNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textTertiary },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  labelLeft: { fontSize: FontSize.xs, color: Colors.textSecondary },
  labelRight: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semiBold },
});

// ── Jackpot Modal ────────────────────────────────────────────────────────────
function JackpotModal({ visible, code, onClose }: { visible: boolean; code: string; onClose: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const openInstagram = () => {
    const url = `instagram://user?username=${ADMIN_INSTAGRAM}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://instagram.com/${ADMIN_INSTAGRAM}`);
      }
    });
  };

  const openEmail = () => {
    const subject = 'Claiming my 5 Referral Reward!';
    const body = `Hi Admin,\n\nMaine 5 successful referrals complete kar liye hain.\nMera referral code: ${code}\n\nPlease mera exclusive reward claim karo.\n\nThanks!`;
    Linking.openURL(
      `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable style={jm.overlay} onPress={onClose}>
        <Animated.View
          style={[jm.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
        >
          <Pressable>
            {/* Glow ring */}
            <View style={jm.glow} />

            <Text style={jm.emoji}>🎉</Text>
            <Text style={jm.title}>Jackpot!</Text>
            <Text style={jm.subtitle}>Tu ZiddiStudent ka Star Inviter ban gaya!</Text>
            <Text style={jm.desc}>
              5 successful referrals complete! Admin se contact karke apna exclusive reward claim kar.
            </Text>

            <View style={jm.codeBox}>
              <Text style={jm.codeLabel}>Your Code</Text>
              <Text style={jm.codeValue}>{code}</Text>
            </View>

            <TouchableOpacity style={jm.instaBtn} onPress={openInstagram} activeOpacity={0.85}>
              <MaterialIcons name="photo-camera" size={20} color="#fff" />
              <Text style={jm.instaBtnText}>Claim via Instagram</Text>
            </TouchableOpacity>

            <TouchableOpacity style={jm.emailBtn} onPress={openEmail} activeOpacity={0.85}>
              <MaterialIcons name="email" size={20} color={Colors.primary} />
              <Text style={jm.emailBtnText}>Claim via Email</Text>
            </TouchableOpacity>

            <TouchableOpacity style={jm.closeBtn} onPress={onClose}>
              <Text style={jm.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const jm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    overflow: 'hidden',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    top: -60,
    left: '50%',
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary + '15',
  },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: Spacing.sm },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  codeBox: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: 2, letterSpacing: 1 },
  codeValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extraBold, color: Colors.primary, letterSpacing: 2 },
  instaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E1306C',
    borderRadius: Radius.md,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 10,
  },
  instaBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.base },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary + '18',
    borderRadius: Radius.md,
    paddingVertical: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    marginBottom: Spacing.sm,
  },
  emailBtnText: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  closeBtn: { paddingVertical: 8 },
  closeBtnText: { color: Colors.textTertiary, fontSize: FontSize.sm },
});

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function ReferralScreen() {
  const router = useRouter();
  const { user } = useApp();
  const [referralCode, setReferralCode] = useState('');
  const [completedReferrals, setCompletedReferrals] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showJackpot, setShowJackpot] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadReferralData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('users')
        .select('my_referral_code')
        .eq('id', authUser.id)
        .single();

      if (profile?.my_referral_code) {
        setReferralCode(profile.my_referral_code);
      }

      const { count } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', authUser.id)
        .eq('status', 'completed');

      setCompletedReferrals(count ?? 0);
    } catch (err) {
      console.log('Referral load error:', err);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => {
    loadReferralData();
  }, [loadReferralData]);

  const copyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message:
          `Yaar, ZiddiStudent app try kar — I've been using it to crush my JEE prep! 🔥\n\nSign up karte waqt mera referral code use kar: ${referralCode}\nTujhe signup par +50 XP bonus milega!\n\n👉 Download now: https://ziddistudent.app`,
        title: 'Join ZiddiStudent with my code!',
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  const handleClaimJackpot = () => setShowJackpot(true);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isJackpotUnlocked = completedReferrals >= MAX_REFERRALS;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <JackpotModal
        visible={showJackpot}
        code={referralCode}
        onClose={() => setShowJackpot(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer and earn</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Hero Banner */}
          <View style={styles.heroBanner}>
            <Text style={styles.heroEmoji}>🎁</Text>
            <Text style={styles.heroTitle}>Dost ko bulao, XP paao!</Text>
            <Text style={styles.heroDesc}>
              Har successful invite par <Text style={styles.bold}>+25 XP</Text> tujhe milega.{'\n'}
              Tera invited dost bhi <Text style={styles.bold}>+50 XP headstart</Text> se shuruat karega.
            </Text>
          </View>

          {/* Referral Code Card */}
          <View style={styles.codeCard}>
            <Text style={styles.codeCardLabel}>TERA UNIQUE CODE</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText} selectable>{referralCode || '------'}</Text>
              <TouchableOpacity
                style={[styles.copyBtn, copied && styles.copyBtnDone]}
                onPress={copyCode}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={copied ? 'check' : 'content-copy'}
                  size={18}
                  color={copied ? Colors.success : Colors.primary}
                />
                <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <MaterialIcons name="share" size={22} color="#fff" />
            <Text style={styles.shareBtnText}>Share on WhatsApp / Instagram</Text>
          </TouchableOpacity>

          {/* Progress Card */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Invite Progress</Text>
              <View style={[styles.progressBadge, isJackpotUnlocked && styles.progressBadgeDone]}>
                <Text style={[styles.progressBadgeText, isJackpotUnlocked && styles.progressBadgeTextDone]}>
                  {isJackpotUnlocked ? '🎉 Jackpot!' : `${completedReferrals}/${MAX_REFERRALS}`}
                </Text>
              </View>
            </View>
            <ProgressBar current={completedReferrals} max={MAX_REFERRALS} />
          </View>

          {/* Jackpot Claim CTA (visible when unlocked) */}
          {isJackpotUnlocked ? (
            <TouchableOpacity style={styles.jackpotBtn} onPress={handleClaimJackpot} activeOpacity={0.85}>
              <Text style={styles.jackpotEmoji}>🏆</Text>
              <View style={styles.jackpotTextBlock}>
                <Text style={styles.jackpotBtnTitle}>Reward Unlocked!</Text>
                <Text style={styles.jackpotBtnSub}>Tap to claim your exclusive reward</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#FFD700" />
            </TouchableOpacity>
          ) : null}

          {/* How it works */}
          <View style={styles.howCard}>
            <Text style={styles.howTitle}>Kaise kaam karta hai?</Text>
            {[
              { step: '1', text: 'Apna code copy kar aur WhatsApp/Instagram par share kar', icon: 'share' as const },
              { step: '2', text: 'Dost signup ke time tera code enter karega', icon: 'person-add' as const },
              { step: '3', text: 'Jab woh apna pehla Focus Session complete karega, tu activate ho jaega', icon: 'timer' as const },
              { step: '4', text: 'Tujhe +25 XP, use +50 XP milega — 5 hone par special reward!', icon: 'card-giftcard' as const },
            ].map(item => (
              <View key={item.step} style={styles.howRow}>
                <View style={styles.howStep}>
                  <MaterialIcons name={item.icon} size={16} color={Colors.primary} />
                </View>
                <Text style={styles.howText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Reward info */}
          <View style={styles.rewardInfo}>
            <MaterialIcons name="info-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.rewardInfoText}>
              5 referrals complete hone par Admin se directly Instagram ya Email par reward claim kar sakte ho.
            </Text>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 60, gap: Spacing.md },

  // Hero
  heroBanner: {
    backgroundColor: Colors.primary + '12',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  heroEmoji: { fontSize: 44, marginBottom: Spacing.sm },
  heroTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extraBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    includeFontPadding: false,
  },
  heroDesc: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  bold: { fontWeight: FontWeight.bold, color: Colors.primary },

  // Code card
  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeCardLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  codeText: {
    fontSize: 26,
    fontWeight: FontWeight.extraBold,
    color: Colors.primary,
    letterSpacing: 3,
    includeFontPadding: false,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary + '18',
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  copyBtnDone: {
    backgroundColor: Colors.success + '18',
    borderColor: Colors.success + '44',
  },
  copyBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.primary },
  copyBtnTextDone: { color: Colors.success },

  // Share
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
  },
  shareBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },

  // Progress
  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  progressBadge: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressBadgeDone: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary + '55',
  },
  progressBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  progressBadgeTextDone: { color: Colors.primary },

  // Jackpot
  jackpotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFD70015',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#FFD70055',
  },
  jackpotEmoji: { fontSize: 32 },
  jackpotTextBlock: { flex: 1 },
  jackpotBtnTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#FFD700',
    includeFontPadding: false,
  },
  jackpotBtnSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // How it works
  howCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  howTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  howStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  howText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Info
  rewardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    opacity: 0.7,
  },
  rewardInfoText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
});
