import { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import StepName from '../components/onboarding/StepName';
import StepExam from '../components/onboarding/StepExam';
import StepGoal from '../components/onboarding/StepGoal';

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [exam, setExam] = useState('JEE');
  const [goalMinutes, setGoalMinutes] = useState(120);
  const [loading, setLoading] = useState(false);

  // Safe validation check taaki navigation tute nahi
  function canProceed() {
    if (step === 1) return name.trim().length >= 2;
    if (step === 2) return true; // Fail-safe: Exam step ko freeze nahi hone dega
    if (step === 3) return goalMinutes > 0;
    return false;
  }

  async function handleFinish() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Agar user authenticated hai toh data silently update hoga
        await supabase
          .from('users')
          .update({
            name: name.trim(),
            target_exam: exam,
            daily_goal_minutes: goalMinutes,
          })
          .eq('id', user.id);
      }
    } catch (error: any) {
      console.log('Database operation bypassed:', error.message);
    }
    setLoading(false);
    
    // Direct explicit route target use kiya hai taaki router confuse na ho
    router.replace('/(tabs)/focus');
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
        {[1, 2, 3].map((s) => (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressDot: {
    height: 6,
    width: 60,
    borderRadius: 3,
    backgroundColor: '#2D2D2D',
  },
  progressDotActive: {
    backgroundColor: '#6B21A8',
  },
  stepCounter: {
    color: '#6B7280',
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
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  backButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#6B21A8',
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
});
