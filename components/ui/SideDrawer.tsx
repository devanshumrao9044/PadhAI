import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Pressable, View, Text, StyleSheet,
  TouchableOpacity, Dimensions, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { getLevelForXP } from '@/constants/levels';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.78, 300);

interface Props {
  visible: boolean;
  onClose: () => void;
}

const MENU_ITEMS = [
  { icon: 'home' as const,           label: 'Home',          route: '/(tabs)'           },
  { icon: 'timer' as const,          label: 'Focus Timer',   route: '/(tabs)/focus'     },
  { icon: 'menu-book' as const,      label: 'Study Tracker', route: '/(tabs)/tracker'   },
  { icon: 'bar-chart' as const,      label: 'Analytics',     route: '/(tabs)/analytics' },
  { icon: 'leaderboard' as const,    label: 'Leaderboard',   route: '/(tabs)/leaderboard' },
  { icon: 'person' as const,         label: 'Profile',       route: '/(tabs)/profile'   },
];

export default function SideDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  // mounted keeps the component in the tree during the close animation
  const [mounted, setMounted] = useState(false);

  const level = user ? getLevelForXP(user.xpTotal) : null;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, tension: 80, friction: 12, useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 180);
  };

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Dim overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'S'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.fullName ?? 'Student'}
            </Text>
            {level ? (
              <View style={styles.levelBadge}>
                <View style={[styles.levelDot, { backgroundColor: level.color }]} />
                <Text style={[styles.levelText, { color: level.color }]}>{level.realisticTitle}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* XP strip */}
        {user ? (
          <View style={styles.xpStrip}>
            <MaterialIcons name="bolt" size={14} color={Colors.warning} />
            <Text style={styles.xpText}>{user.xpTotal} XP</Text>
            <View style={styles.xpDivider} />
            <MaterialIcons name="local-fire-department" size={14} color={Colors.danger} />
            <Text style={styles.xpText}>{user.streakCurrent} day streak</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        {/* Menu items */}
        <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => navigate(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconWrap}>
                <MaterialIcons name={item.icon} size={20} color={Colors.textSecondary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}

          <View style={styles.divider} />

          {/* Refer & Earn — highlighted */}
          <TouchableOpacity
            style={styles.referItem}
            onPress={() => navigate('/referral')}
            activeOpacity={0.8}
          >
            <View style={styles.referIconWrap}>
              <MaterialIcons name="card-giftcard" size={20} color={Colors.primary} />
            </View>
            <View style={styles.referTextBlock}>
              <Text style={styles.referLabel}>Refer and earn</Text>
              <Text style={styles.referSub}>Invite friends, earn XP + rewards</Text>
            </View>
            <View style={styles.referBadge}>
              <Text style={styles.referBadgeText}>NEW</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ZiddiStudent • Har din padhna hai</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 100,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    zIndex: 101,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '22',
    borderWidth: 2,
    borderColor: Colors.primary + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    includeFontPadding: false,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  xpStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceVariant,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: Spacing.sm,
  },
  xpText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  xpDivider: { width: 1, height: 12, backgroundColor: Colors.border, marginHorizontal: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm, marginHorizontal: Spacing.md },
  menuScroll: { flex: 1 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  // Refer & Earn highlighted row
  referItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    backgroundColor: Colors.primary + '0F',
    borderTopWidth: 0,
  },
  referIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referTextBlock: { flex: 1 },
  referLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  referSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  referBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  referBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.extraBold,
    color: '#fff',
    letterSpacing: 1,
  },
  footer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  footerText: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center' },
});
