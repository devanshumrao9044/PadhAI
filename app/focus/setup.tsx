import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getItem, setItem } from '@/features/core/services/storage';
import {
  focusGuardSetupKey,
  getFocusGuardStatus,
  openOverlayPermissionSettings,
  openUsageStatsPermissionSettings,
  type FocusGuardStatus,
} from '@/features/focus/services/focusGuard';

const DEFAULT_RETURN_ROUTE = '/(tabs)/focus';

type ReturnRoute = '/(tabs)/focus' | '/(tabs)';

export default function FocusGuardSetupScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { user } = useApp();
  const [status, setStatus] = useState<FocusGuardStatus>(() => getFocusGuardStatus());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const returnRoute: ReturnRoute = params.returnTo === '/(tabs)' ? '/(tabs)' : DEFAULT_RETURN_ROUTE;

  const finish = useCallback(async () => {
    if (!user?.id || working) return;
    setWorking(true);
    await setItem(focusGuardSetupKey(user.id), true);
    router.replace(returnRoute as Parameters<typeof router.replace>[0]);
  }, [returnRoute, router, user?.id, working]);

  const refresh = useCallback(() => {
    const next = getFocusGuardStatus();
    setStatus(next);
    setLoading(false);
    if (next.overlay && next.usageStats && user?.id) void finish();
  }, [finish, user?.id]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getItem<boolean>(focusGuardSetupKey(user.id)).then(seen => {
      if (cancelled) return;
      const current = getFocusGuardStatus();
      setStatus(current);
      setLoading(false);
      if (seen && current.overlay && current.usageStats) void finish();
    });
    return () => { cancelled = true; };
  }, [finish, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const handleContinue = () => {
    if (working) return;
    if (!status.overlay) {
      openOverlayPermissionSettings();
    } else if (!status.usageStats) {
      openUsageStatsPermissionSettings();
    } else {
      void finish();
    }
  };

  if (Platform.OS !== 'android') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <MaterialIcons name="check-circle" size={54} color={colors.success} />
          <Text style={styles.title}>{t('focus.guardSetupTitle')}</Text>
          <Text style={styles.subtitle}>{t('focus.guardIosHint')}</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace(returnRoute as Parameters<typeof router.replace>[0])}>
            <Text style={styles.primaryButtonText}>{t('focus.guardContinue')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="security" size={34} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>{t('focus.guardTitle')}</Text>
        <Text style={styles.title}>{t('focus.guardSetupTitle')}</Text>
        <Text style={styles.subtitle}>{t('focus.guardSetupSubtitle')}</Text>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={styles.stepsCard}>
            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, status.overlay && styles.stepIconDone]}>
                <MaterialIcons name={status.overlay ? 'check' : 'layers'} size={22} color={status.overlay ? colors.success : colors.primary} />
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{t('focus.guardOverlayStep')}</Text>
                <Text style={styles.stepBody}>{status.overlay ? t('focus.guardPermissionReady') : t('focus.guardOverlayHint')}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, status.usageStats && styles.stepIconDone]}>
                <MaterialIcons name={status.usageStats ? 'check' : 'query-stats'} size={22} color={status.usageStats ? colors.success : colors.primary} />
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{t('focus.guardUsageStep')}</Text>
                <Text style={styles.stepBody}>{status.usageStats ? t('focus.guardPermissionReady') : t('focus.guardUsageHint')}</Text>
              </View>
            </View>
          </View>
        )}

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (loading || working) && styles.disabled]} onPress={handleContinue} disabled={loading || working}>
          {working ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>{status.overlay && status.usageStats ? t('focus.guardContinue') : t('focus.guardOpenNext')}</Text>}
        </Pressable>
        <Text style={styles.note}>{t('focus.guardSetupSystemNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: Spacing.xl, paddingBottom: Spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  headerIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary + '55', marginBottom: Spacing.md },
  eyebrow: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.3, textAlign: 'center', textTransform: 'uppercase' },
  title: { color: colors.textPrimary, fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold, textAlign: 'center', marginTop: 8 },
  subtitle: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 22, textAlign: 'center', marginTop: 10, marginBottom: Spacing.xl },
  stepsCard: { backgroundColor: colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  stepIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18' },
  stepIconDone: { backgroundColor: colors.success + '18' },
  stepCopy: { flex: 1 },
  stepTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, marginBottom: 4 },
  stepBody: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.border },
  primaryButton: { minHeight: 54, borderRadius: Radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  primaryButtonText: { color: colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold, textAlign: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  note: { color: colors.textTertiary, fontSize: FontSize.xs, lineHeight: 18, textAlign: 'center', marginTop: Spacing.md },
  loading: { alignItems: 'center', paddingVertical: Spacing.xxl },
});
