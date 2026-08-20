import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import StepName from '../components/onboarding/StepName';
import StepExam from '../components/onboarding/StepExam';
import StepGoal from '../components/onboarding/StepGoal';
import { useApp } from '../hooks/useApp';
import type { UserProfile } from '../types/models';

const TOTAL_STEPS = 3;

type LearnerType = UserProfile['classLevel'];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user: appUser, setUser, setOnboarded } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [exam, setExam] = useState<UserProfile['targetExam']>('OTHER');
  const [learnerType, setLearnerType] = useState<LearnerType>('SELF_STUDY');
  const [goalMinutes, setGoalMinutes] = useState(120);
  const [loading, setLoading] = useState(false);

  const canSkip = Boolean(appUser?.fullName && appUser.fullName !== 'Student');

  function canProceed() {
    if (step === 1) return name.trim().length >= 2;
    if (step === 2) return Boolean(exam && learnerType);
    if (step === 3) return goalMinutes > 0;
    return false;
  }

  async function handleFinish() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(t('onboarding.sessionExpiredTitle'), t('onboarding.sessionExpiredMessage'));
        setLoading(false);
        router.replace('/');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          target_exam: exam,
          class: learnerType,
          daily_goal_minutes: goalMinutes,
        })
        .eq('id', user.id);

      if (error) {
        setLoading(false);
        Alert.alert(t('onboarding.saveErrorTitle'), t('onboarding.saveErrorMessage'));
        return;
      }

      if (appUser?.id === user.id) {
        await setUser({
          ...appUser,
          fullName: name.trim(),
          targetExam: exam,
          classLevel: learnerType,
          dailyGoalMinutes: goalMinutes,
        });
      }
      await setOnboarded(true);
      setLoading(false);
      router.replace('/first-time-help');
    } catch (error: any) {
      setLoading(false);
      Alert.alert(t('onboarding.saveErrorTitle'), error?.message || t('onboarding.saveErrorMessage'));
    }
  }

  async function handleSkip() {
    if (!canSkip || loading) return;
    await setOnboarded(true);
    router.replace('/(tabs)');
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(current => current + 1);
    } else {
      void handleFinish();
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.progressContainer} accessibilityLabel={t('onboarding.stepOf', { step, total: TOTAL_STEPS })}>
              {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map(dot => (
                <View key={dot} style={[styles.progressDot, dot <= step && styles.progressDotActive]} />
              ))}
            </View>
            {canSkip ? (
              <TouchableOpacity onPress={() => { void handleSkip(); }} style={styles.skipButton} disabled={loading}>
                <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.stepCounter}>{t('onboarding.stepOf', { step, total: TOTAL_STEPS })}</Text>

          <View style={styles.content}>
            <Animated.View
              key={`onboarding-step-${step}`}
              entering={SlideInRight.duration(280)}
              exiting={SlideOutLeft.duration(200)}
              style={styles.animatedStep}
            >
              {step === 1 ? <StepName value={name} onChange={setName} /> : null}
              {step === 2 ? (
                <StepExam
                  value={exam}
                  onChange={value => setExam(value as UserProfile['targetExam'])}
                  learnerType={learnerType}
                  onLearnerTypeChange={setLearnerType}
                />
              ) : null}
              {step === 3 ? <StepGoal value={goalMinutes} onChange={setGoalMinutes} /> : null}
            </Animated.View>
          </View>

          <View style={styles.footer}>
            {step > 1 ? (
              <TouchableOpacity style={styles.backButton} onPress={() => setStep(current => current - 1)} disabled={loading}>
                <Text style={styles.backButtonText}>← {t('onboarding.back')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.nextButton, step === 1 && styles.nextButtonFull, !canProceed() && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={!canProceed() || loading}
            >
              {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.nextButtonText}>{step === TOTAL_STEPS ? t('onboarding.startNow') : t('onboarding.next')} →</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16 },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 10 },
  topBar: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressContainer: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  progressDot: { height: 6, flex: 1, maxWidth: 70, borderRadius: 3, backgroundColor: colors.surfaceVariant },
  progressDotActive: { backgroundColor: colors.primary },
  skipButton: { paddingVertical: 6, paddingHorizontal: 2 },
  skipText: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  stepCounter: { color: colors.textTertiary, fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 8, marginBottom: 8, fontWeight: '600', letterSpacing: 0.4 },
  content: { flexGrow: 1, justifyContent: 'center', minHeight: 500, paddingVertical: 8 },
  animatedStep: { flex: 1 },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 12, paddingBottom: 8 },
  backButton: { flex: 1, minHeight: 52, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  backButtonText: { color: colors.textSecondary, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  nextButton: { flex: 1.7, minHeight: 52, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  nextButtonFull: { flex: 1 },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { color: colors.background, fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
});
