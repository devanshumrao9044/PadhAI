import { supabase } from '@/features/core/services/supabase';
import { readUserCache, writeUserCache } from '@/features/core/services/cache';
import type { CalendarEvent, TodoItem } from '@/types/models';

export async function loadTodoItems(userId: string): Promise<TodoItem[]> {
  // 1. Try to fetch from Cloud (Single Source of Truth)
  const { data, error } = await supabase
    .from('todos')
    .select('items')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && data) {
    // 2. Update local cache with fresh cloud data
    await writeUserCache(userId, 'todo', data.items);
    return data.items as TodoItem[];
  }
  
  // 3. Offline fallback: Read from local cache if network fails
  return (await readUserCache<TodoItem[]>(userId, 'todo'))?.data ?? [];
}

export async function saveTodoItems(userId: string, items: TodoItem[]): Promise<void> {
  // 1. Save to Cloud
  const { error } = await supabase
    .from('todos')
    .upsert({ user_id: userId, items }, { onConflict: 'user_id' });

  if (error) {
    console.warn('[productivity] Failed to sync Todo items to cloud:', error);
  }

  // 2. Always save to local cache (optimistic update/offline support)
  await writeUserCache(userId, 'todo', items);
}

export async function loadCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  // 1. Try to fetch from Cloud
  const { data, error } = await supabase
    .from('calendar_events')
    .select('events')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && data) {
    // 2. Update local cache
    await writeUserCache(userId, 'calendar', data.events);
    return data.events as CalendarEvent[];
  }

  // 3. Offline fallback
  return (await readUserCache<CalendarEvent[]>(userId, 'calendar'))?.data ?? [];
}

export async function saveCalendarEvents(userId: string, events: CalendarEvent[]): Promise<void> {
  // 1. Save to Cloud
  const { error } = await supabase
    .from('calendar_events')
    .upsert({ user_id: userId, events }, { onConflict: 'user_id' });

  if (error) {
    console.warn('[productivity] Failed to sync Calendar events to cloud:', error);
  }

  // 2. Always save to local cache
  await writeUserCache(userId, 'calendar', events);
}
