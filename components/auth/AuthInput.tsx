import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  TextInputProps
} from 'react-native';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export default function AuthInput({ label, error, secureTextEntry, ...props }: AuthInputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputError : styles.inputNormal]}>
        <TextInput
          style={styles.input}
          placeholderTextColor="#4B5563"
          selectionColor="#7C5CFC"
          secureTextEntry={isPassword && !visible}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setVisible(v => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.eyeBtn}
          >
            <Text style={styles.eyeIcon}>{visible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  inputNormal: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inputError: {
    borderColor: 'rgba(255, 71, 87, 0.5)',
    backgroundColor: 'rgba(255, 71, 87, 0.04)',
  },
  input: {
    flex: 1,
    color: '#F1F1F6',
    fontSize: 15,
    includeFontPadding: false,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  eyeIcon: {
    fontSize: 16,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});
