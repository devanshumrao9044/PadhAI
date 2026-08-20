import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors } from '@/constants/theme';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function StepName({ value, onChange }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.heading}>{t('onboarding.nameTitle')}</Text>
      <Text style={styles.subtext}>{t('onboarding.nameSubtitle')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('onboarding.namePlaceholder')}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChange}
        autoFocus
        maxLength={30}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 16,
    textAlign: 'center',
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    color: colors.textTertiary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    color: colors.textPrimary,
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
});
