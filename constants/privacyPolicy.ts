/**
 * Draft privacy-policy content for PadhAI.
 *
 * Keep the owner/company wording, effective date, retention details, and
 * jurisdiction-specific language up to date before public release. This is
 * product copy, not a substitute for legal review.
 */
export const PRIVACY_POLICY = {
  appName: 'PadhAI',
  contactEmail: 'materialhubx@gmail.com',
  effectiveDate: '15 August 2026',
  ownerLabel: 'PadhAI app owner',
};

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: '1. What this policy covers',
    paragraphs: [
      `This Privacy Policy explains how ${PRIVACY_POLICY.appName} collects, uses, stores, and protects information when you use the app. It is currently effective from ${PRIVACY_POLICY.effectiveDate}.`,
    ],
  },
  {
    title: '2. Information we collect',
    paragraphs: [
      'Account information may include your email address, name, authentication provider, user ID, profile photo, target exam, class, and daily study goal.',
      'Study information may include subjects, chapters, focus sessions, study durations, daily summaries, XP, streaks, leaderboard information, referral activity, and blocked-app settings that you choose to save.',
      'When you sign in with Google, Google provides the basic profile information permitted by the Google consent screen, such as your email address, name, and profile image. PadhAI does not request access to Gmail messages, contacts, Drive files, or other Google services.',
      'The app stores the authentication session locally on your device or browser so that you can remain signed in. We do not intentionally collect precise location, contacts, microphone recordings, or payment information through the current app.',
    ],
  },
  {
    title: '3. How we use information',
    paragraphs: [
      'We use information to create and secure your account, synchronize your study data across sessions, provide progress tracking and analytics, calculate XP and streaks, operate referrals and leaderboards, save your profile preferences, and troubleshoot reliability or security issues.',
      'We do not sell or rent your personal information. We use service providers only as needed to operate the app, including Supabase for authentication, database, and file storage, and Google for optional Google authentication.',
    ],
  },
  {
    title: '4. Storage and security',
    paragraphs: [
      'PadhAI uses authenticated sessions and row-level access controls to help restrict account data to the appropriate user. Avatar images are stored in the app storage service and are used through image URLs. No online service can guarantee absolute security, so please use a strong password and protect access to your device and Google account.',
    ],
  },
  {
    title: '5. Retention and account deletion',
    paragraphs: [
      'We keep account and study information while your account is active or as needed to provide the service. To request account deletion or ask what information is associated with your account, email us at the contact address below. We will review and process the request subject to applicable legal, security, and operational requirements.',
    ],
  },
  {
    title: '6. Children and age requirements',
    paragraphs: [
      'PadhAI is intended for learners. If you are below the minimum age required by the laws that apply to you, use the app only with the involvement and permission of a parent or guardian. We do not knowingly collect personal information from children without the permissions required by applicable law.',
    ],
  },
  {
    title: '7. Changes and contact',
    paragraphs: [
      `We may update this policy when the app, services, or applicable requirements change. The latest version will be available in the app. For privacy questions, access or deletion requests, contact the ${PRIVACY_POLICY.ownerLabel} at ${PRIVACY_POLICY.contactEmail}.`,
    ],
  },
];
