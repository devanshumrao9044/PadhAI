import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeColors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { getLevelForRank } from '@/constants/levels';

type Props = { visible: boolean; onClose: () => void };

type GuidePage = { title: string; body: string; icon: 'bolt' | 'military-tech' | 'trending-up' };

export default function LeaderboardGuideSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [page, setPage] = useState(0);
  const levelFour = getLevelForRank(4);
  const pages: GuidePage[] = [
    { title: t('leaderboard.guideXpTitle'), body: t('leaderboard.guideXpBody'), icon: 'bolt' },
    { title: t('leaderboard.guideLevelsTitle'), body: t('leaderboard.guideLevelsBody'), icon: 'military-tech' },
    { title: t('leaderboard.zonesTitle'), body: t('leaderboard.guideIntro'), icon: 'trending-up' },
  ];
  const currentPage = pages[page];

  useEffect(() => {
    if (visible) setPage(0);
  }, [visible]);

  const move = (direction: -1 | 1) => {
    const next = page + direction;
    if (next < 0) return;
    if (next >= pages.length) { onClose(); return; }
    setPage(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.headerTitle}>{t('leaderboard.infoTitle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel={t('common.close')}>
              <MaterialIcons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.progressRow}>
            {pages.map((_, index) => <View key={index} style={[styles.progressSegment, index === page && styles.progressSegmentActive]} />)}
          </View>

          <View style={styles.pageBody}>
            <TouchableOpacity style={styles.sideTapLeft} onPress={() => move(-1)} accessibilityLabel={t('leaderboard.guidePrevious')} />
            <View style={styles.pageContent}>
              <View style={styles.pageTitleRow}>
                <MaterialIcons name={currentPage.icon} size={26} color={colors.primary} />
                <Text style={styles.pageTitle}>{currentPage.title}</Text>
              </View>
              <Text style={styles.pageBodyText}>{currentPage.body}</Text>

              {page === 1 ? (
                <View style={styles.levelIllustration}>
                  <View style={[styles.levelGlow, { backgroundColor: levelFour.color + '24' }]} />
                  <View style={[styles.levelBadge, { borderColor: levelFour.color, backgroundColor: levelFour.color + '22' }]}>
                    <Text style={[styles.levelNumber, { color: levelFour.color }]}>4</Text>
                    <MaterialIcons name="star" size={20} color={levelFour.color} />
                  </View>
                  <Text style={[styles.levelCaption, { color: levelFour.color }]}>{t('leaderboard.level', { value: 4 })} • {levelFour.realisticTitle}</Text>
                </View>
              ) : null}

              {page === 0 ? (
                <View style={styles.xpIllustration}>
                  <View style={styles.xpHexagon}><MaterialIcons name="bolt" size={42} color={colors.primary} /></View>
                  <Text style={styles.illustrationCaption}>{t('leaderboard.xpEarned')}</Text>
                </View>
              ) : null}

              {page === 2 ? (
                <View style={styles.zoneList}>
                  <View style={[styles.zoneCard, { backgroundColor: colors.success + '14' }]}><MaterialIcons name="arrow-upward" size={22} color={colors.success} /><View style={styles.zoneCopy}><Text style={styles.zoneTitle}>{t('leaderboard.guidePromotionTitle')}</Text><Text style={styles.zoneBody}>{t('leaderboard.guidePromotionBody')}</Text></View></View>
                  <View style={[styles.zoneCard, { backgroundColor: colors.warning + '14' }]}><MaterialIcons name="remove" size={22} color={colors.warning} /><View style={styles.zoneCopy}><Text style={styles.zoneTitle}>{t('leaderboard.guideSafetyTitle')}</Text><Text style={styles.zoneBody}>{t('leaderboard.guideSafetyBody')}</Text></View></View>
                  <View style={[styles.zoneCard, { backgroundColor: colors.danger + '14' }]}><MaterialIcons name="arrow-downward" size={22} color={colors.danger} /><View style={styles.zoneCopy}><Text style={styles.zoneTitle}>{t('leaderboard.guideDemotionTitle')}</Text><Text style={styles.zoneBody}>{t('leaderboard.guideDemotionBody')}</Text></View></View>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.sideTapRight} onPress={() => move(1)} accessibilityLabel={t('leaderboard.guideNext')} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerHint}>{page === 0 ? t('leaderboard.guideNext') : page === pages.length - 1 ? t('leaderboard.guideDone') : t('leaderboard.guideNext')}</Text>
            <TouchableOpacity style={styles.footerButton} onPress={() => move(1)}>
              <Text style={styles.footerButtonText}>{page === pages.length - 1 ? t('leaderboard.guideDone') : t('common.ok')}</Text>
              <MaterialIcons name={page === pages.length - 1 ? 'check' : 'arrow-forward'} size={18} color={colors.background} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { minHeight: '74%', maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, borderWidth: 1, borderColor: colors.border },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: Radius.full, backgroundColor: colors.borderStrong, marginBottom: Spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.textPrimary, fontSize: FontSize.md, lineHeight: 21, fontWeight: FontWeight.extraBold, flexShrink: 1 },
  closeButton: { padding: 6 },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: Spacing.sm, marginBottom: Spacing.md },
  progressSegment: { flex: 1, height: 4, borderRadius: Radius.full, backgroundColor: colors.border },
  progressSegmentActive: { backgroundColor: colors.primary },
  pageBody: { flex: 1, flexDirection: 'row', position: 'relative' },
  pageContent: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm, paddingTop: Spacing.md },
  sideTapLeft: { position: 'absolute', left: -Spacing.md, top: 0, bottom: 0, width: 44, zIndex: 2 },
  sideTapRight: { position: 'absolute', right: -Spacing.md, top: 0, bottom: 0, width: 44, zIndex: 2 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.md, width: '100%' },
  pageTitle: { color: colors.primary, fontSize: FontSize.xl, lineHeight: 28, fontWeight: FontWeight.extraBold, textAlign: 'center', flexShrink: 1 },
  pageBodyText: { color: colors.textSecondary, fontSize: FontSize.md, lineHeight: 24, textAlign: 'center', flexShrink: 1 },
  xpIllustration: { alignItems: 'center', marginTop: Spacing.xl },
  xpHexagon: { width: 130, height: 116, borderRadius: 24, transform: [{ rotate: '30deg' }], alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '18', borderWidth: 3, borderColor: colors.primary + '77' },
  illustrationCaption: { color: colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, marginTop: Spacing.lg },
  levelIllustration: { alignItems: 'center', marginTop: Spacing.lg },
  levelGlow: { position: 'absolute', top: -14, width: 170, height: 170, borderRadius: 85 },
  levelBadge: { width: 138, height: 138, borderRadius: 69, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  levelNumber: { fontSize: 48, fontWeight: FontWeight.extraBold, includeFontPadding: false },
  levelCaption: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: Spacing.md },
  zoneList: { width: '100%', gap: Spacing.sm, marginTop: Spacing.lg },
  zoneCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border },
  zoneCopy: { flex: 1, minWidth: 0 },
  zoneTitle: { color: colors.textPrimary, fontSize: FontSize.base, lineHeight: 20, fontWeight: FontWeight.bold, marginBottom: 3, flexShrink: 1 },
  zoneBody: { color: colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19, flexShrink: 1 },
  footer: { gap: Spacing.sm, marginTop: Spacing.md },
  footerHint: { color: colors.textTertiary, textAlign: 'center', fontSize: FontSize.xs },
  footerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: colors.primary, borderRadius: Radius.md, paddingVertical: 13 },
  footerButtonText: { color: colors.background, fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
