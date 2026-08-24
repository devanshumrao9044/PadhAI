import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  getInstalledApps,
  launchStudyApp,
  type InstalledFocusApp,
} from '@/features/focus/services/focusGuard';

export default function AllowedAppsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { activeSession } = useApp();
  const [apps, setApps] = useState<InstalledFocusApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [launchFailedPackage, setLaunchFailedPackage] = useState<string | null>(null);

  const loadApps = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setApps(getInstalledApps());
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeSession) {
      router.replace('/(tabs)/focus');
      return;
    }
    loadApps();
  }, [activeSession, loadApps, router]);

  const policyReasonLabel = (reason: string) => {
    switch (reason) {
      case 'known_study': return t('focus.allowedAppsReasonKnownStudy');
      case 'study_label_match': return t('focus.allowedAppsReasonStudyLabel');
      case 'essential_system': return t('focus.allowedAppsReasonEssential');
      case 'android_productivity_category': return t('focus.allowedAppsReasonProductivity');
      case 'android_game_category': return t('focus.allowedAppsReasonGame');
      case 'hard_deny': return t('focus.allowedAppsReasonHardDeny');
      case 'cache': return t('focus.allowedAppsReasonCache');
      default: return t('focus.allowedAppsReasonUnknown');
    }
  };

  const handleOpen = (packageName: string) => {
    setLaunchFailedPackage(null);
    if (!launchStudyApp(packageName)) setLaunchFailedPackage(packageName);
  };

  if (Platform.OS !== 'android') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.emptyState}>
          <MaterialIcons name="phone-android" size={42} color={colors.primary} />
          <Text style={styles.emptyTitle}>{t('focus.studyAppsAndroidOnly')}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadApps(true)} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()} activeOpacity={0.8}>
            <MaterialIcons name="arrow-back" size={21} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{t('focus.studyAppsVerified')}</Text>
            <Text style={styles.title}>{t('focus.allowedAppsTitle')}</Text>
          </View>
          <View style={styles.shieldCircle}>
            <MaterialIcons name="verified-user" size={21} color={colors.primary} />
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><MaterialIcons name="school" size={26} color={colors.primary} /></View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t('focus.allowedAppsSubtitle')}</Text>
            <Text style={styles.heroText}>{t('focus.studyAppsAutomaticOnly')}</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t('focus.allowedAppsListTitle')}</Text>
          <Text style={styles.countText}>{apps.length}</Text>
        </View>

        {loading ? (
          <View style={styles.emptyState}><ActivityIndicator color={colors.primary} /><Text style={styles.emptyText}>{t('focus.studyAppsLoading')}</Text></View>
        ) : apps.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="school" size={42} color={colors.primary} />
            <Text style={styles.emptyTitle}>{t('focus.studyAppsEmpty')}</Text>
            <Text style={styles.emptyText}>{t('focus.allowedAppsRefreshHint')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {apps.map(app => (
              <View key={app.packageName} style={styles.appRow}>
                <View style={[styles.appIcon, !app.allowed && styles.appIconBlocked]}><MaterialIcons name={app.allowed ? 'menu-book' : 'block'} size={21} color={app.allowed ? colors.primary : colors.textTertiary} /></View>
                <View style={styles.appCopy}>
                  <Text style={styles.appName} numberOfLines={1}>{app.label}</Text>
                  <View style={styles.metaLine}>
                    <Text style={[styles.categoryText, app.allowed ? styles.categoryAllowed : styles.categoryBlocked]}>{app.category}</Text>
                    <Text style={styles.reasonText}>{app.allowed ? `${t('focus.allowedAppsVerifiedStatus')} · ${policyReasonLabel(app.reason)}` : `${t('focus.allowedAppsBlockedStatus')} · ${policyReasonLabel(app.reason)}`}</Text>
                  </View>
                </View>
                {app.allowed ? (
                  <View style={styles.actionColumn}>
                    <TouchableOpacity style={styles.openButton} onPress={() => handleOpen(app.packageName)} activeOpacity={0.82}>
                      <Text style={styles.openButtonText}>{t('focus.allowedAppsOpen')}</Text>
                      <MaterialIcons name="open-in-new" size={16} color={colors.background} />
                    </TouchableOpacity>
                    {launchFailedPackage === app.packageName ? <Text style={styles.failureText}>{t('focus.allowedAppsReasonLaunchFailed')}</Text> : null}
                  </View>
                ) : (
                  <View style={styles.blockedPill}><MaterialIcons name="lock" size={14} color={colors.danger} /><Text style={styles.blockedPillText}>{t('focus.allowedAppsBlocked')}</Text></View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  backCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  headerCopy: { flex: 1, marginLeft: Spacing.md },
  eyebrow: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 3 },
  title: { color: colors.textPrimary, fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold },
  shieldCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.xl, backgroundColor: colors.primary + '12', borderWidth: 1, borderColor: colors.primary + '35', marginBottom: Spacing.xl },
  heroIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { color: colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold, lineHeight: 21 },
  heroText: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19, marginTop: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { flex: 1, color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  countText: { minWidth: 28, textAlign: 'center', color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold, backgroundColor: colors.primary + '18', borderRadius: Radius.full, paddingVertical: 5, paddingHorizontal: 9 },
  list: { gap: 10 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  appIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  appIconBlocked: { backgroundColor: colors.surfaceVariant },
  appCopy: { flex: 1, minWidth: 0 },
  appName: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semiBold },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  categoryText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  categoryAllowed: { color: colors.success },
  categoryBlocked: { color: colors.textTertiary },
  reasonText: { color: colors.textTertiary, fontSize: FontSize.xs },
  actionColumn: { alignItems: 'flex-end', maxWidth: 150, gap: 5 },
  openButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: 11, paddingVertical: 9 },
  openButtonText: { color: colors.background, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  blockedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: colors.danger + '12' },
  blockedPillText: { color: colors.danger, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  failureText: { color: colors.danger, fontSize: 10, lineHeight: 13, textAlign: 'right' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70, gap: 10 },
  emptyTitle: { color: colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold, textAlign: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  backButton: { backgroundColor: colors.primary, borderRadius: Radius.md, paddingHorizontal: 22, paddingVertical: 12, marginTop: 8 },
  backButtonText: { color: colors.background, fontWeight: FontWeight.bold },
});
