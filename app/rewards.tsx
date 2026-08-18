import React, { useMemo, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

type Tab = 'coupons' | 'howItWorks' | 'faqs';

const FAQS: { question: 'faqOne' | 'faqTwo' | 'faqThree'; answer: 'faqOneAnswer' | 'faqTwoAnswer' | 'faqThreeAnswer' }[] = [
  { question: 'faqOne', answer: 'faqOneAnswer' },
  { question: 'faqTwo', answer: 'faqTwoAnswer' },
  { question: 'faqThree', answer: 'faqThreeAnswer' },
];

export default function RewardsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('howItWorks');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} accessibilityLabel={t('common.back')}>
          <MaterialIcons name="arrow-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rewards.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.tabs}>
        {(['coupons', 'howItWorks', 'faqs'] as const).map(item => (
          <TouchableOpacity key={item} style={styles.tab} onPress={() => setTab(item)} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{t(`rewards.${item}`)}</Text>
            {tab === item ? <View style={styles.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'coupons' ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><MaterialIcons name="local-offer" size={34} color={colors.primary} /></View>
            <Text style={styles.sectionHeading}>{t('rewards.coupons')}</Text>
            <Text style={styles.bodyText}>{t('rewards.emptyCoupons')}</Text>
          </View>
        ) : null}

        {tab === 'howItWorks' ? (
          <View>
            <Text style={styles.sectionHeading}>{t('rewards.howItWorksHeading')}</Text>
            <View style={styles.featureCard}>
              <View style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.warning + '22' }]}>
                  <MaterialIcons name="card-giftcard" size={28} color={colors.warning} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{t('rewards.earningTitle')}</Text>
                  <Text style={styles.featureBody}>{t('rewards.earningBody')}</Text>
                </View>
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + '22' }]}>
                  <MaterialIcons name="emoji-events" size={28} color={colors.primary} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{t('rewards.rewardTypesTitle')}</Text>
                  <Text style={styles.featureBody}>{t('rewards.rewardTypesBody')}</Text>
                </View>
              </View>
            </View>
            <View style={styles.milestoneCard}>
              <MaterialIcons name="bolt" size={22} color={colors.warning} />
              <View style={styles.featureCopy}>
                <Text style={styles.milestoneTitle}>{t('rewards.xpMilestone')}</Text>
                <Text style={styles.featureBody}>{t('rewards.streakPerk')} • {t('rewards.referralProgress')}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {tab === 'faqs' ? (
          <View>
            <Text style={styles.sectionHeading}>{t('rewards.faqHeading')}</Text>
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <TouchableOpacity key={faq.question} style={[styles.faqCard, isOpen && styles.faqCardOpen]} onPress={() => setOpenFaq(isOpen ? null : index)} activeOpacity={0.85}>
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{t(`rewards.${faq.question}`)}</Text>
                    <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={24} color={colors.textPrimary} />
                  </View>
                  {isOpen ? <Text style={styles.faqAnswer}>{t(`rewards.${faq.answer}`)}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.extraBold },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: Spacing.sm },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58, position: 'relative' },
  tabText: { color: colors.textSecondary, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  tabTextActive: { color: colors.primary, fontWeight: FontWeight.bold },
  tabUnderline: { position: 'absolute', left: 12, right: 12, bottom: -1, height: 3, borderRadius: Radius.full, backgroundColor: colors.primary },
  content: { padding: Spacing.md, paddingBottom: 100 },
  sectionHeading: { color: colors.textPrimary, fontSize: FontSize.xxl, fontWeight: FontWeight.extraBold, marginBottom: Spacing.md },
  emptyState: { alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.xl },
  emptyIcon: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary + '44', marginBottom: Spacing.md },
  bodyText: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 22 },
  featureCard: { backgroundColor: colors.warning + '0C', borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.warning + '44', overflow: 'hidden' },
  featureRow: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, alignItems: 'flex-start' },
  featureIcon: { width: 58, height: 58, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1 },
  featureTitle: { color: colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 5 },
  featureBody: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 21 },
  featureDivider: { height: 1, backgroundColor: colors.warning + '2A', marginHorizontal: Spacing.md },
  milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  milestoneTitle: { color: colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold, marginBottom: 3 },
  faqCard: { backgroundColor: colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.border },
  faqCardOpen: { backgroundColor: colors.surface, borderColor: colors.primary + '66' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  faqQuestion: { flex: 1, color: colors.textPrimary, fontSize: FontSize.md, lineHeight: 24, fontWeight: FontWeight.semiBold },
  faqAnswer: { color: colors.textSecondary, fontSize: FontSize.base, lineHeight: 21, marginTop: Spacing.sm, paddingRight: Spacing.xl },
});
