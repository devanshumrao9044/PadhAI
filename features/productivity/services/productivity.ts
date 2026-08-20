import { readUserCache, writeUserCache } from '@/features/core/services/cache';
import type { CalendarEvent, SubjectTimerState, TodoItem } from '@/types/models';

export async function loadTodoItems(userId: string): Promise<TodoItem[]> {
  return (await readUserCache<TodoItem[]>(userId, 'todo'))?.data ?? [];
}

export async function saveTodoItems(userId: string, items: TodoItem[]): Promise<void> {
  await writeUserCache(userId, 'todo', items);
}

export async function loadCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  return (await readUserCache<CalendarEvent[]>(userId, 'calendar'))?.data ?? [];
}

export async function saveCalendarEvents(userId: string, events: CalendarEvent[]): Promise<void> {
  await writeUserCache(userId, 'calendar', events);
}

export async function loadSubjectTimers(userId: string): Promise<Record<string, SubjectTimerState>> {
  return (await readUserCache<Record<string, SubjectTimerState>>(userId, 'subjectTimers'))?.data ?? {};
}

export async function saveSubjectTimers(userId: string, timers: Record<string, SubjectTimerState>): Promise<void> {
  await writeUserCache(userId, 'subjectTimers', timers);
}
