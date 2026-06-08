import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function Stats() {
  useEffect(() => {
    router.replace('/(tabs)/analytics');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F',
      justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#A855F7" />
    </View>
  );
}
