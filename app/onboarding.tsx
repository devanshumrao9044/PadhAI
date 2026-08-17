import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import StepName from '../components/onboarding/StepName';
import StepExam from '../components/onboarding/StepExam';
import StepGoal from '../components/onboarding/StepGoal';
import { useApp } from '../hooks/useApp';
import type { UserProfile } from '../types/models';

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user: appUser, setUser, setOnboarded } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [exam, setExam] = useState('JEE');
  const [studentClass, setStudentClass] = useState('12th');
  const [goalMinutes, setGoalMinutes] = useState(120);
  const [loading, setLoading] = useState(false);


  function canProceed() {
    if (step === 1) return name.trim().length >= 2;
    if (step === 2) return true;
    if (step === 3) return !!studentClass;
    if (step === 4) return goalMinutes > 0;
    return false;
  }


  async function handleFinish() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Session Expired', 'Please sign in again.');
        setLoading(false);
        router.replace('/');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          target_exam: exam,
          class: studentClass,
          daily_goal_minutes: goalMinutes,
        })
        .eq('id', user.id);

      if (error) {
        setLoading(false);
        Alert.alert(
          'Could Not Save Profile',
          'Something went wrong saving your details. Please check your connection and try again.'
        );
        return;
      }

      if (appUser?.id === user.id) {
        await setUser({
          ...appUser,
          fullName: name.trim(),
          targetExam: exam as UserProfile['targetExam'],
          classLevel: studentClass as UserProfile['classLevel'],
          dailyGoalMinutes: goalMinutes,
        });
      }
      await setOnboarded(true);
      setLoading(false);
      router.replace('/(tabs)/focus');

    } catch (error: any) {
      setLoading(false);
      Alert.alert(
        'Could Not Save Profile',
        error?.message || 'Something went wrong. Please try again.'
      );
    }
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {/* Step Counter */}
      <Text style={styles.stepCounter}>
        Step {step} of {TOTAL_STEPS}
      </Text>

      {/* Step Content */}
      <View style={styles.content}>
        {step === 1 && (
          <StepName value={name} onChange={setName} />
        )}

        {step === 2 && (
          <StepExam value={exam} onChange={setExam} />
        )}


        {step === 3 && (
          <View style={styles.classContainer}>
            <Text style={styles.classTitle}>Which is your class? </Text>
            <Text style={styles.classSubtitle}>This will help to understand your syllabus better. </Text>

            <View style={styles.classOptionsGrid}>
              {['11th', '12th', 'Dropper'].map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.classOption,
                    studentClass === c && styles.classOptionActive
                  ]}
                  onPress={() => setStudentClass(c)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.classOptionText,
                    studentClass === c && styles.classOptionTextActive
                  ]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <StepGoal value={goalMinutes} onChange={setGoalMinutes} />
        )}
      </View>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            step === 1 && styles.nextButtonFull,
          ]}
          onPress={handleNext}
          disabled={!canProceed() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === TOTAL_STEPS ? 'Start Now' : 'Next →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressDot: {
    height: 6,
    flex: 1,
    maxWidth: 60,
    borderRadius: 3,
    backgroundColor: colors.surfaceVariant,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  stepCounter: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 24,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  classContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  classTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  classSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  classOptionsGrid: {
    gap: 16,
  },
  classOption: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  classOptionActive: {
    backgroundColor: colors.primary + '26',
    borderColor: colors.primary,
  },
  classOptionText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  classOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});

