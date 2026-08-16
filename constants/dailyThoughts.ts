export type DailyThought = { en: string; hi: string };

export const DAILY_THOUGHTS: DailyThought[] = [
  { en: 'Success is the sum of small efforts repeated daily.', hi: 'सफलता रोज़ दोहराए गए छोटे प्रयासों का परिणाम है।' },
  { en: 'The secret of getting ahead is getting started.', hi: 'आगे बढ़ने का रहस्य शुरुआत करने में है।' },
  { en: 'Study hard today for a better tomorrow.', hi: 'बेहतर कल के लिए आज मेहनत करो।' },
  { en: 'Toppers stop when the work is done, not when they are tired.', hi: 'टॉपर थकने पर नहीं, काम पूरा होने पर रुकते हैं।' },
  { en: 'Every expert was once a beginner.', hi: 'हर विशेषज्ञ कभी शुरुआती था।' },
  { en: 'Your future is created by what you do today.', hi: 'तुम्हारा भविष्य आज के काम से बनता है।' },
  { en: 'Consistency beats intensity when intensity does not last.', hi: 'जब जोश टिकता नहीं, तब निरंतरता जीतती है।' },
  { en: 'One focused hour can change the direction of your day.', hi: 'एक केंद्रित घंटा पूरे दिन की दिशा बदल सकता है।' },
  { en: 'Do not wait for motivation; build a routine.', hi: 'प्रेरणा का इंतज़ार मत करो, दिनचर्या बनाओ।' },
  { en: 'Small progress is still progress.', hi: 'छोटी प्रगति भी प्रगति ही होती है।' },
  { en: 'Discipline turns goals into results.', hi: 'अनुशासन लक्ष्य को परिणाम में बदलता है।' },
  { en: 'The best time to revise is before you forget.', hi: 'भूलने से पहले दोहराना सबसे अच्छा समय है।' },
  { en: 'A clear plan makes a difficult chapter easier.', hi: 'स्पष्ट योजना कठिन अध्याय को आसान बना देती है।' },
  { en: 'Focus on the next useful step.', hi: 'अगले उपयोगी कदम पर ध्यान दो।' },
  { en: 'You do not need a perfect day to make meaningful progress.', hi: 'अर्थपूर्ण प्रगति के लिए दिन का परफेक्ट होना ज़रूरी नहीं।' },
  { en: 'Learn deeply today, recall confidently tomorrow.', hi: 'आज गहराई से सीखो, कल आत्मविश्वास से याद करो।' },
  { en: 'The chapter you avoid is often the chapter that needs you most.', hi: 'जिस अध्याय से बचते हो, अक्सर उसी पर सबसे ज़्यादा ध्यान चाहिए।' },
  { en: 'Your study desk is a promise to your future self.', hi: 'तुम्हारी स्टडी टेबल तुम्हारे भविष्य के स्वयं से किया वादा है।' },
  { en: 'Progress grows quietly before it becomes visible.', hi: 'प्रगति दिखने से पहले चुपचाप बढ़ती है।' },
  { en: 'Hard questions are invitations to become stronger.', hi: 'कठिन सवाल बेहतर बनने का निमंत्रण हैं।' },
  { en: 'Protect your attention; it is your most valuable study tool.', hi: 'अपना ध्यान बचाओ; यही तुम्हारा सबसे कीमती अध्ययन साधन है।' },
  { en: 'A steady learner can outlast a talented procrastinator.', hi: 'निरंतर सीखने वाला प्रतिभाशाली टालमटोल करने वाले से आगे निकल सकता है।' },
  { en: 'Finish one important thing before chasing ten new things.', hi: 'दस नई चीज़ों के पीछे भागने से पहले एक ज़रूरी काम पूरा करो।' },
  { en: 'Every revision makes the next revision easier.', hi: 'हर दोहराव अगली बार को आसान बनाता है।' },
  { en: 'Your pace can be slow; your direction must stay clear.', hi: 'गति धीमी हो सकती है, दिशा स्पष्ट रहनी चाहिए।' },
  { en: 'Confidence is built by keeping promises to yourself.', hi: 'आत्मविश्वास खुद से किए वादे निभाने से बनता है।' },
  { en: 'A focused mind turns ordinary time into an advantage.', hi: 'एकाग्र मन साधारण समय को भी बढ़त में बदल देता है।' },
  { en: 'Make today useful, not merely busy.', hi: 'आज को सिर्फ व्यस्त नहीं, उपयोगी बनाओ।' },
  { en: 'The habit of returning to your goal is a superpower.', hi: 'अपने लक्ष्य पर लौटने की आदत एक महाशक्ति है।' },
  { en: 'Do the difficult ten minutes first.', hi: 'पहले कठिन दस मिनट पूरे करो।' },
  { en: 'You are closer than you were yesterday.', hi: 'तुम कल से अपने लक्ष्य के और करीब हो।' },
];

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function getThoughtForDate(date = new Date()): DailyThought {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const seed = year * 100 + month + 1;
  const random = seededRandom(seed);
  const pool = DAILY_THOUGHTS.map((thought, index) => ({ thought, index }));
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const monthlyThoughts = pool.slice(0, daysInMonth);
  return monthlyThoughts[(day - 1) % monthlyThoughts.length].thought;
}
