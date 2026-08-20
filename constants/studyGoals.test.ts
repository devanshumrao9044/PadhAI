import test from 'node:test';
import assert from 'node:assert/strict';
import { LEARNER_TYPES, PROFILE_LEARNER_TYPES, STUDY_GOALS } from './studyGoals.ts';
import { translate } from './translations.ts';

const languages = ['en', 'hi'] as const;

test('every supported study goal has bilingual labels and descriptions', () => {
  assert.equal(STUDY_GOALS.length, 7);
  for (const language of languages) {
    for (const goal of STUDY_GOALS) {
      const label = translate(language, `onboarding.${goal.labelKey}` as never);
      const description = translate(language, `onboarding.${goal.subKey}` as never);
      assert.ok(label.trim().length > 0, `${language} ${goal.id} label is empty`);
      assert.ok(description.trim().length > 0, `${language} ${goal.id} description is empty`);
      assert.notEqual(label, `onboarding.${goal.labelKey}`);
      assert.notEqual(description, `onboarding.${goal.subKey}`);
    }
  }
});

test('every onboarding learner type has bilingual labels', () => {
  assert.equal(LEARNER_TYPES.length, 5);
  for (const language of languages) {
    for (const learner of LEARNER_TYPES) {
      const label = translate(language, `onboarding.${learner.labelKey}` as never);
      assert.ok(label.trim().length > 0, `${language} ${learner.id} label is empty`);
      assert.notEqual(label, `onboarding.${learner.labelKey}`);
    }
  }
});

test('Profile retains legacy class values while supporting every new learner type', () => {
  for (const value of ['11th', '12th', 'Dropper']) {
    assert.ok(PROFILE_LEARNER_TYPES.includes(value as typeof PROFILE_LEARNER_TYPES[number]));
  }
  for (const learner of LEARNER_TYPES) {
    assert.ok(PROFILE_LEARNER_TYPES.includes(learner.id as typeof PROFILE_LEARNER_TYPES[number]));
  }
});
