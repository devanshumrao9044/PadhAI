import type { Chapter, Subject, Topic } from '@/types/models';

export function reconcileTrackerState(
  nextSubjects: Subject[],
  nextChapters: Chapter[],
  nextTopics: Topic[],
): { subjects: Subject[]; chapters: Chapter[]; topics: Topic[] } {
  const subjects = nextSubjects.filter(subject => !subject.isDeleted);
  const activeSubjectIds = new Set(subjects.map(subject => subject.id));
  const chapters = nextChapters.filter(chapter => (
    !chapter.isDeleted && activeSubjectIds.has(chapter.subjectId)
  ));
  const activeChapterIds = new Set(chapters.map(chapter => chapter.id));
  const topics = nextTopics.filter(topic => (
    !topic.isDeleted && activeChapterIds.has(topic.chapterId)
  ));
  return { subjects, chapters, topics };
}
