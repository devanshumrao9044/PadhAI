import { View, Text, TextInput, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function StepName({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.heading}>Name</Text>
      <Text style={styles.subtext}>
        only be asked once 
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Eg- Devansh "
        placeholderTextColor="#4B5563"
        value={value}
        onChangeText={onChange}
        autoFocus
        maxLength={30}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 16,
    textAlign: 'center',
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 18,
    color: '#FFFFFF',
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    textAlign: 'center',
  },
});
