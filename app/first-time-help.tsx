import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getItem, setItem } from '@/features/core/services/storage';

const helpKey = (userId: string) => `padhai:first-time-help-seen:${userId}`;

const HELP_STEPS = [
  { icon: 'library-books' as const, title: 'Add your subjects', body: 'Open Study Tracker and add the subjects and chapters you want to study.' },
  { icon: 'timer' as const, title: 'Start a Focus session', body: 'Choose a chapter, set your study time, and focus without distractions.' },
  { icon: 'bolt' as const, title: 'Earn XP and build streaks', body: 'Complete sessions to earn weekly XP, maintain your streak, and move up levels.' },
  { icon: 'leaderboard' as const, title: 'See rankings and referral rewards', body: 'Your live level ranking updates with your XP. A referred user earns the referral bonus after completing their first session.' },
];

export default function FirstTimeHelpScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useApp();
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const seen = await getItem<boolean>(helpKey(user.id));
      if (cancelled) return;
      if (seen) {
        router.replace('/focus/setup' as Parameters<typeof router.replace>[0]);
      } else {
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const finish = async () => {
    if (!user?.id || working) return;
    setWorking(true);
    await setItem(helpKey(user.id), true);
    router.replace('/focus/setup' as Parameters<typeof router.replace>[0]);
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="school" size={34} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>WELCOME TO PADHAI</Text>
        <Text style={styles.title}>A quick guide to get started</Text>
        <Text style={styles.subtitle}>You can start small. PadhAI will help you stay consistent every day.</Text>

        <View style={styles.stepsCard}>
          {HELP_STEPS.map((step, index) => (
            <View key={step.title} style={[styles.stepRow, index === HELP_STEPS.length - 1 && styles.stepRowLast]}>
              <View style={styles.stepIcon}>
                <MaterialIcons name={step.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={finish} disabled={working}>
          {working ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>Start learning</Text>}
        </Pressable>
        <Pressable style={styles.skipButton} onPress={finish} disabled={working}>
          <Text style={styles.skipText}>Skip guide</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: Spacing.xl, paddingBottom: 32 },
  headerIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: colors.primary + '1C', borderWidth: 1, borderColor: colors.primary + '55', marginBottom: Spacing.md },
  eyebrow: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.4, textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold, textAlign: 'center', marginTop: 8 },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 22, textAlign: 'center', marginTop: 10, marginBottom: Spacing.xl },
  stepsCard: { backgroundColor: colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  stepRow: { flexDirection: 'row', gap: 12, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepRowLast: { borderBottomWidth: 0 },
  stepIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18' },
  stepText: { flex: 1 },
  stepTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, marginBottom: 4 },
  stepBody: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  primaryButton: { minHeight: 52, borderRadius: Radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl },
  primaryButtonText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  skipButton: { alignItems: 'center', paddingVertical: Spacing.md },
  skipText: { color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },
});
