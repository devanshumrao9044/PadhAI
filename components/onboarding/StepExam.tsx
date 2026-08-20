import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';
import type { UserProfile } from '@/types/models';
import { STUDY_GOALS, LEARNER_TYPES } from '@/constants/studyGoals';

interface Props {
  value: string;
  onChange: (val: string) => void;
  learnerType: UserProfile['classLevel'];
  onLearnerTypeChange: (value: UserProfile['classLevel']) => void;
}

export default function StepExam({ value, onChange, learnerType, onLearnerTypeChange }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.heading}>{t('onboarding.targetTitle')}</Text>
      <Text style={styles.subtext}>{t('onboarding.targetSubtitle')}</Text>
      <View style={styles.list}>
        {STUDY_GOALS.map(target => (
          <TouchableOpacity
            key={target.id}
            style={[styles.card, value === target.id && styles.cardSelected]}
            onPress={() => onChange(target.id)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === target.id }}
            accessibilityLabel={`${t(`onboarding.${target.labelKey}`)}. ${t(`onboarding.${target.subKey}`)}`}
          >
            <Text style={styles.cardEmoji}>{target.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={[styles.cardLabel, value === target.id && styles.cardLabelSelected]}>
                {t(`onboarding.${target.labelKey}`)}
              </Text>
              <Text style={styles.cardSub}>{t(`onboarding.${target.subKey}`)}</Text>
            </View>
            {value === target.id ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionHeading}>{t('onboarding.learnerTitle')}</Text>
      <Text style={styles.sectionSubtext}>{t('onboarding.learnerSubtitle')}</Text>
      <View style={styles.learnerGrid}>
        {LEARNER_TYPES.map(learner => (
          <TouchableOpacity
            key={learner.id}
            style={[styles.learnerCard, learnerType === learner.id && styles.cardSelected]}
            onPress={() => onLearnerTypeChange(learner.id)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: learnerType === learner.id }}
            accessibilityLabel={t(`onboarding.${learner.labelKey}`)}
          >
            <Text style={styles.learnerEmoji}>{learner.emoji}</Text>
            <Text style={[styles.learnerLabel, learnerType === learner.id && styles.cardLabelSelected]}>
              {t(`onboarding.${learner.labelKey}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 2 },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: 8 },
  heading: { color: colors.textPrimary, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  subtext: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  list: { gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, gap: 12 },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '26' },
  cardEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  cardText: { flex: 1, minWidth: 0 },
  cardLabel: { color: colors.textPrimary, fontSize: 15, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
  cardLabelSelected: { color: colors.primaryGlow },
  cardSub: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 1, flexShrink: 1 },
  check: { color: colors.primary, fontSize: 20, lineHeight: 22, fontWeight: '900' },
  sectionHeading: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: '800', textAlign: 'center', marginTop: 22, marginBottom: 4 },
  sectionSubtext: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 10 },
  learnerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingBottom: 8 },
  learnerCard: { width: '31%', minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  learnerEmoji: { fontSize: 22 },
  learnerLabel: { color: colors.textSecondary, fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});
