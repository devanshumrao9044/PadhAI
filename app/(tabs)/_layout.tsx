import { Tabs } from 'expo-router';
import { View, Image, ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({
  source,
  color,
  focused,
}: {
  source: ImageSourcePropType;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
      <Image
        source={source}
        style={{
          width: 24,
          height: 24,
          tintColor: color,
          transform: [{ scale: focused ? 1.1 : 1 }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: '#2D2D2D',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 6,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#A855F7',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              source={require('../../assets/images/Home.png')}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              source={require('../../assets/images/timer.png')}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              source={require('../../assets/images/tracker.png')}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              source={require('../../assets/images/Analytics.png')}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Rank',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              source={require('../../assets/images/Leaderboard.png')}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              source={require('../../assets/images/Profile.png')}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen name="stats" options={{ href: null }} />
    </Tabs>
  );
}
