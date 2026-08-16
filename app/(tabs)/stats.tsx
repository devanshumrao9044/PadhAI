import { useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function Stats() {
  const { colors } = useTheme();
  useEffect(() => {
    router.replace('/(tabs)/analytics');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background,
      justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
