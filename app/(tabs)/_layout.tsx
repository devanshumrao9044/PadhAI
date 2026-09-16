import React, { useRef } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router'; // ✅ FIXED: Imported router hooks
import { Platform, View, PanResponder } from 'react-native'; // ✅ FIXED: Imported View and PanResponder
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { haptics } from '@/features/core/services/haptics';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const tabBarHeight = Platform.select({
    ios: insets.bottom + 60,
    android: insets.bottom + 60,
    default: 70,
  });

  // ✅ FIXED: Tab order defined for sequential swiping
  const tabRoutes = ['/', '/focus', '/tracker', '/analytics', '/profile'];

  // ✅ FIXED: Global PanResponder to handle middle-screen swipes smoothly
  const panResponder = useRef(
    PanResponder.create({
      // Reject vertical scrolls, only accept strong horizontal swipes (dx > 40)
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 40 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentIndex = tabRoutes.indexOf(pathname);
        if (currentIndex === -1) return;

        // Swipe Left (Negative DX) -> Next Tab
        if (gestureState.dx < -50 && currentIndex < tabRoutes.length - 1) {
          void haptics.tabSwitch();
          router.push(tabRoutes[currentIndex + 1] as any);
        }
        // Swipe Right (Positive DX) -> Previous Tab
        else if (gestureState.dx > 50 && currentIndex > 0) {
          void haptics.tabSwitch();
          router.push(tabRoutes[currentIndex - 1] as any);
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <Tabs
        screenListeners={{
          tabPress: () => { void haptics.tabSwitch(); },
        }}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: Platform.select({
              ios: insets.bottom + 8,
              android: insets.bottom + 8,
              default: 8,
            }),
            paddingHorizontal: 4,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="focus"
          options={{
            title: 'Study Session',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="timer" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tracker"
          options={{
            title: 'Tracker',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="menu-book" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="bar-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="person" size={size} color={color} />
            ),
          }}
        />
        {/* Hidden screens — not shown in tab bar */}
        <Tabs.Screen
          name="stats"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}
