export const STUDY_GOALS = [
  { id: 'JEE', labelKey: 'targetJee', subKey: 'targetJeeSub', emoji: '⚛️' },
  { id: 'NEET', labelKey: 'targetNeet', subKey: 'targetNeetSub', emoji: '🩺' },
  { id: 'BOARDS', labelKey: 'targetBoards', subKey: 'targetBoardsSub', emoji: '📚' },
  { id: 'UPSC', labelKey: 'targetUpsc', subKey: 'targetUpscSub', emoji: '🏛️' },
  { id: 'COLLEGE', labelKey: 'targetCollege', subKey: 'targetCollegeSub', emoji: '🎓' },
  { id: 'SKILLS', labelKey: 'targetSkills', subKey: 'targetSkillsSub', emoji: '💡' },
  { id: 'OTHER', labelKey: 'targetOther', subKey: 'targetOtherSub', emoji: '✨' },
] as const;

export const LEARNER_TYPES = [
  { id: 'SCHOOL', labelKey: 'learnerSchool', emoji: '🏫' },
  { id: 'COLLEGE', labelKey: 'learnerCollege', emoji: '🎓' },
  { id: 'Dropper', labelKey: 'learnerDropper', emoji: '🗓️' },
  { id: 'PROFESSIONAL', labelKey: 'learnerProfessional', emoji: '💼' },
  { id: 'SELF_STUDY', labelKey: 'learnerSelfStudy', emoji: '📖' },
] as const;

export const PROFILE_LEARNER_TYPES = ['11th', '12th', 'Dropper', 'SCHOOL', 'COLLEGE', 'PROFESSIONAL', 'SELF_STUDY'] as const;

export type StudyGoalId = typeof STUDY_GOALS[number]['id'];
export type LearnerTypeId = typeof LEARNER_TYPES[number]['id'];
