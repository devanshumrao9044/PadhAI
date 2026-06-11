import { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Pressable, Dimensions
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

interface Props {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userCode?: string | null;
}

const DRAWER_WIDTH = Dimensions.get('window').width * 0.78;

export default function SideDrawer({ visible, onClose, userName, userCode }: Props) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0, duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH, duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0, duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  async function handleSignOut() {
    onClose();
    await supabase.auth.signOut();
    router.replace('/');
  }

  function navigate(path: string) {
    onClose();
    router.push(path as any);
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Drawer Panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>

        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName ? userName.charAt(0).toUpperCase() : 'S'}
            </Text>
          </View>
          <View>
            <Text style={styles.userName} numberOfLines={1}>
              {userName ?? 'Student'}
            </Text>
            {userCode ? (
              <Text style={styles.userCode}>Code: {userCode}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Menu Items */}
        <View style={styles.menu}>

          <DrawerItem
            emoji="🎁"
            label="Refer & Earn"
            sublabel="Earn XP for every referral"
            onPress={() => navigate('/referral')}
            highlight
          />

          <DrawerItem
            emoji="👤"
            label="Profile"
            onPress={() => navigate('/(tabs)/profile')}
          />

          <DrawerItem
            emoji="📊"
            label="Analytics"
            onPress={() => navigate('/(tabs)/analytics')}
          />

        </View>

        <View style={styles.spacer} />

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>PadhAI v1.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function DrawerItem({
  emoji, label, sublabel, onPress, highlight
}: {
  emoji: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, highlight && styles.menuItemHighlight]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <View style={styles.menuTextCol}>
        <Text style={[styles.menuLabel, highlight && styles.menuLabelHighlight]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.menuSublabel}>{sublabel}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0C0C15',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  userSection: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(124, 92, 252, 0.2)',
    borderWidth: 1, borderColor: 'rgba(124, 92, 252, 0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#7C5CFC', fontSize: 20, fontWeight: '800' },
  userName: { color: '#F1F1F6', fontSize: 16, fontWeight: '700', maxWidth: 160 },
  userCode: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  divider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 20,
  },
  menu: { gap: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12,
  },
  menuItemHighlight: {
    backgroundColor: 'rgba(124, 92, 252, 0.08)',
    borderWidth: 1, borderColor: 'rgba(124, 92, 252, 0.15)',
  },
  menuEmoji: { fontSize: 20 },
  menuTextCol: { flex: 1 },
  menuLabel: { color: '#D1D5DB', fontSize: 15, fontWeight: '600' },
  menuLabelHighlight: { color: '#A78BFA' },
  menuSublabel: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  spacer: { flex: 1 },
  signOutBtn: {
    borderRadius: 12, paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 71, 87, 0.2)',
    backgroundColor: 'rgba(255, 71, 87, 0.05)',
    marginBottom: 16,
  },
  signOutText: { color: '#FF4757', fontSize: 14, fontWeight: '700' },
  footer: { alignItems: 'center' },
  footerText: { color: '#374151', fontSize: 11 },
});
