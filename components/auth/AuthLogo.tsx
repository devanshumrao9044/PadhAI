import { View, Text, StyleSheet } from 'react-native';

export default function AuthLogo() {
  return (
      <View style={styles.container}>
            <View style={styles.logoBox}>
                    <Text style={styles.logoText}>पढ़</Text>
                            <Text style={styles.logoAI}>AI</Text>
                                  </View>
                                        <Text style={styles.tagline}>Stay Focused. Study hard. No excuses. </Text>
                                            </View>
                                              );
                                              }

                                              const styles = StyleSheet.create({
                                                container: {
                                                    alignItems: 'center',
                                                        marginBottom: 40,
                                                          },
                                                            logoBox: {
                                                                flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                        marginBottom: 8,
                                                                          },
                                                                            logoText: {
                                                                                fontSize: 52,
                                                                                    fontWeight: '900',
                                                                                        color: '#FFFFFF',
                                                                                          },
                                                                                            logoAI: {
                                                                                                fontSize: 52,
                                                                                                    fontWeight: '900',
                                                                                                        color: '#6B21A8',
                                                                                                          },
                                                                                                            tagline: {
                                                                                                                color: '#9CA3AF',
                                                                                                                    fontSize: 16,
                                                                                                                      },
                                                                                                                      });