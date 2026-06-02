import { View, Text, StyleSheet } from 'react-native';

const quotes = [
  { en: "Success is the sum of small efforts repeated daily.", hi: "सफलता छोटे प्रयासों का योग है।" },
  { en: "The secret of getting ahead is getting started.", hi: "आगे बढ़ने का रहस्य शुरुआत करना है।" },
  { en: "Study hard today for a better tomorrow.", hi: "आज मेहनत करो, कल बेहतर होगा।" },
  { en: "Toppers don't stop when they're tired. They stop when they're done.", hi: "टॉपर थकने पर नहीं, काम पूरा होने पर रुकते हैं।" },
  { en: "Every expert was once a beginner.", hi: "हर विशेषज्ञ कभी शुरुआती था।" },
];

export default function QuoteCard() {
  const today = new Date().getDate();
  const quote = quotes[today % quotes.length];

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>💭</Text>
      <Text style={styles.quote}>"{quote.en}"</Text>
      <Text style={styles.quoteHi}>{quote.hi}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    borderLeftWidth: 4,
    borderLeftColor: '#6B21A8',
    marginBottom: 24,
  },
  icon: {
    fontSize: 24,
    marginBottom: 10,
  },
  quote: {
    color: '#FFFFFF',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 8,
  },
  quoteHi: {
    color: '#9CA3AF',
    fontSize: 13,
    fontStyle: 'italic',
  },
});
