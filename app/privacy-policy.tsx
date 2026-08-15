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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: { minWidth: 70, paddingVertical: 10 },
  backText: { color: '#B5A6FF', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#F1F1F6', fontSize: 17, fontWeight: '800' },
  headerSpacer: { minWidth: 70 },
  content: { padding: 24, paddingBottom: 48 },
  logo: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', textAlign: 'center' },
  logoAccent: { color: '#7C5CFC' },
  title: { color: '#F1F1F6', fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  meta: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginTop: 8 },
  intro: { color: '#C7C7D4', fontSize: 15, lineHeight: 23, marginTop: 24 },
  section: { marginTop: 26 },
  sectionTitle: { color: '#F1F1F6', fontSize: 17, fontWeight: '800', marginBottom: 9 },
  paragraph: { color: '#C7C7D4', fontSize: 15, lineHeight: 23, marginBottom: 10 },
  contactCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#151521',
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.4)',
  },
  contactTitle: { color: '#B5A6FF', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  contactText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 6 },
});
