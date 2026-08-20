import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from './translations.ts';

test('core screens return the selected language without duplicating JSX copy', () => {
  assert.equal(translate('en', 'focus.lockInMinutes', { value: 30 }), 'LOCK IN — 30 MIN');
  assert.equal(translate('hi', 'focus.lockInMinutes', { value: 30 }), 'फोकस शुरू करें — 30 मिनट');
  assert.equal(translate('en', 'analytics.weakChapters', { value: 2 }), 'WEAK CHAPTERS (2)');
  assert.equal(translate('hi', 'analytics.weakChapters', { value: 2 }), 'कमज़ोर अध्याय (2)');
  assert.equal(translate('en', 'referral.moreReferrals', { value: 3 }), '3 more referrals to unlock your reward.');
  assert.equal(translate('hi', 'referral.moreReferrals', { value: 3 }), 'रिवॉर्ड अनलॉक करने के लिए 3 और रेफरल चाहिए।');
  assert.equal(translate('en', 'groups.title'), 'Study Groups');
  assert.equal(translate('hi', 'groups.title'), 'स्टडी ग्रुप');
  assert.equal(translate('en', 'support.helpSupport'), 'Help & Support');
  assert.equal(translate('en', 'support.reportProblem'), 'Report a problem');
  assert.equal(translate('hi', 'support.helpSupport'), 'मदद और सहायता');
  assert.equal(translate('hi', 'support.reportProblem'), 'समस्या बताएं');
  assert.equal(translate('en', 'support.raiseTicket'), 'Raise a ticket');
  assert.equal(translate('hi', 'support.reviewTicketsReports'), 'टिकट / रिपोर्ट देखें');
  assert.equal(translate('en', 'groups.linkCopied'), 'Invite link copied.');
  assert.equal(translate('hi', 'support.ownerOnly'), 'यह section केवल PadhAI owner के लिए उपलब्ध है।');
});

test('translation interpolation preserves unresolved placeholders instead of silently dropping them', () => {
  assert.equal(translate('en', 'common.minutes', {}), '{value} minutes');
});
