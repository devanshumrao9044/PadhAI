import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

interface Props {
  onSwitchToLogin: () => void;
}

export default function SignupForm({ onSwitchToLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!name || !email || !password) {
      Alert.alert('Error', 'fill all fields ');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password should be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      // Validate referral code if provided
      let referrerId: string | null = null;
      const trimmedCode = referralCode.trim().toUpperCase();
      if (trimmedCode) {
        const { data: refUser } = await supabase
          .from('users')
          .select('id')
          .eq('my_referral_code', trimmedCode)
          .single();
        if (!refUser) {
          Alert.alert('Invalid Code', 'Yeh referral code valid nahi hai. Check karke try kar.');
          setLoading(false);
          return;
        }
        referrerId = refUser.id;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;

      // If referral code was valid, update referred_by and create pending referral
      if (referrerId && data.user) {
        await supabase
          .from('users')
          .update({ referred_by: referrerId })
          .eq('id', data.user.id);

        await supabase.from('referrals').insert([{
          referrer_id: referrerId,
          referee_id: data.user.id,
          status: 'pending',
        }]);
      }

      Alert.alert('✅ Account is created!', 'Login now.');
      onSwitchToLogin();
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message);
    }
    setLoading(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Join PadhAI 🎯</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#9CA3AF"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor="#9CA3AF"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password (min 6 characters)"
        placeholderTextColor="#9CA3AF"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* Optional referral code — always visible */}
      <View style={styles.referralBox}>
        <MaterialIcons name="card-giftcard" size={16} color="#9B7FFF" />
        <Text style={styles.referralBoxLabel}>Referral Code (optional)</Text>
      </View>
      <TextInput
        style={[styles.input, styles.referralInput]}
        placeholder="e.g. STU-ABC123"
        placeholderTextColor="#6B7280"
        value={referralCode}
        onChangeText={setReferralCode}
        autoCapitalize="characters"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Sign Up →</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchToLogin}>
        <Text style={styles.switchText}>
          Already have an account? Login Now
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2D2D2D',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  button: {
    backgroundColor: '#6B21A8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchText: {
    color: '#6B21A8',
    textAlign: 'center',
    fontSize: 14,
  },
  referralBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
    marginTop: 2,
  },
  referralBoxLabel: {
    color: '#9B7FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  referralInput: {
    borderColor: '#6B21A8',
    borderWidth: 1.5,
    letterSpacing: 2,
    color: '#C4B5FD',
    marginBottom: 0,
  },
});
