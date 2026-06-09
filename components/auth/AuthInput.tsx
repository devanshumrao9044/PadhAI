import {
  View, Text, TextInput,
  StyleSheet, TextInputProps
} from 'react-native';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export default function AuthInput({ label, error, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : styles.inputNormal,
        ]}
        placeholderTextColor="#4B5563"
        {...props}
      />
      <View style={styles.errorContainer}>
        {error ? (
          <Text style={styles.errorText}>⚠ {error}</Text>
        ) : (
          <Text style={styles.errorPlaceholder}> </Text>
        )}
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
  },
  inputNormal: {
    backgroundColor: '#1A1A27',
    borderColor: 'rgba(255,255,255,0.07)',
  },
  inputError: {
    backgroundColor: 'rgba(255, 71, 87, 0.05)',
    borderColor: '#FF4757',
  },
  errorContainer: {
    minHeight: 20,
    marginTop: 4,
    marginLeft: 2,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 12,
    fontWeight: '600',
  },
  errorPlaceholder: {
    color: 'transparent',
    fontSize: 12,
  },
});
