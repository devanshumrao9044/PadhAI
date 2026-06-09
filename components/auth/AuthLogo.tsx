import { View, Text, StyleSheet } from 'react-native';

export default function AuthLogo() {
  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>पढ़</Text>
        <Text style={styles.logoAI}>AI</Text>
      </View>
      <Text style={styles.tagline}>
        "Stay Focused. Study Hard. No Excuses."
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  logoAI: {
    fontSize: 56,
    fontWeight: '900',
    color: '#7C5CFC',
    includeFontPadding: false,
  },
  tagline: {
    color: '#6B7280',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
