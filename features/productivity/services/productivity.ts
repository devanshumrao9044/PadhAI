import { readUserCache, writeUserCache } from '@/features/core/services/cache';
import type { CalendarEvent, TodoItem } from '@/types/models';

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
