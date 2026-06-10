import {
  View, Text, TextInput,
  StyleSheet, TextInputProps, Platform
} from 'react-native';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export default function AuthInput({ label, error, style, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : styles.inputNormal,
          style,
        ]}
        placeholderTextColor="#4B5563"
        // ✅ Removes browser blue outline on web
        {...(Platform.OS === 'web' ? { outlineWidth: 0 } : {})}
        {...props}
      />
      <View style={styles.errorSlot}>
        {error
          ? <Text style={styles.errorText}>⚠ {error}</Text>
          : null
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F1F1F6',
    fontSize: 15,
    borderWidth: 1.5,
    // ✅ Kills the default browser focus box on web
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none',
      outlineWidth: 0,
      outline: 'none',
    } : {}),
  } as any,
  inputNormal: {
    backgroundColor: '#1A1A27',
    borderColor: 'rgba(255,255,255,0.07)',
  },
  inputError: {
    backgroundColor: 'rgba(255, 71, 87, 0.05)',
    borderColor: '#FF4757',
  },
  errorSlot: {
    minHeight: 20,
    marginTop: 4,
    marginLeft: 2,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 12,
    fontWeight: '600',
  },
});
