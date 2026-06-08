import { View, Text, StyleSheet } from 'react-native';
export default function Stats() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📊 Analytics</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F',
    justifyContent: 'center', alignItems: 'center' },
  text: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
