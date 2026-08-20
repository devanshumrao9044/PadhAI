import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeColors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.surfaceVariant]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>
        <MaterialIcons name="search-off" size={80} color={colors.primary} />
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.message}>
          The page you are looking for is not available right now.
        </Text>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/')}
          accessibilityRole="button"
          accessibilityLabel="Return home"
        >
          <Text style={styles.homeButtonText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.sm, textAlign: 'center' },
  message: { fontSize: FontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22, maxWidth: 420 },
  homeButton: { backgroundColor: colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.full },
  homeButtonText: { color: colors.background, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
