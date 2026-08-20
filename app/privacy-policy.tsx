import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_POLICY, PRIVACY_POLICY_SECTIONS } from '@/constants/privacyPolicy';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>पढ़<Text style={styles.logoAccent}>AI</Text></Text>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.meta}>Effective {PRIVACY_POLICY.effectiveDate}</Text>
        <Text style={styles.intro}>
          We want you to understand what information PadhAI uses and why. This policy is maintained in the app source so the owner can update the editable policy details as the product changes.
        </Text>

        {PRIVACY_POLICY_SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map(paragraph => (
              <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
            ))}
          </View>
        ))}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Privacy contact</Text>
          <Text style={styles.contactText}>{PRIVACY_POLICY.contactEmail}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { minWidth: 70, paddingVertical: 10 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  headerSpacer: { minWidth: 70 },
  content: { padding: 24, paddingBottom: 48 },
  logo: { color: colors.textPrimary, fontSize: 38, fontWeight: '900', textAlign: 'center' },
  logoAccent: { color: colors.primary },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  meta: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8 },
  intro: { color: colors.textSecondary, fontSize: 15, lineHeight: 23, marginTop: 24 },
  section: { marginTop: 26 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 9 },
  paragraph: { color: colors.textSecondary, fontSize: 15, lineHeight: 23, marginBottom: 10 },
  contactCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.primary + '66',
  },
  contactTitle: { color: colors.primary, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  contactText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 6 },
});
