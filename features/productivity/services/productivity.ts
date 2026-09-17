import { supabase } from '@/features/core/services/supabase';
import { readUserCache, writeUserCache } from '@/features/core/services/cache';
import type { CalendarEvent, TodoItem } from '@/types/models';

export async function loadTodoItems(userId: string): Promise<TodoItem[]> {
  try {
    const { data, error } = await supabase.from('todos').select('items').eq('user_id', userId).maybeSingle();
    if (!error && data) {
      const items = (data.items as TodoItem[]) ?? [];
      await writeUserCache(userId, 'todo', items); // offline fallback के लिए cache भी update करो
      return items;
    }
  } catch {
    // network नहीं है — नीचे local cache पर fallback करो
  }
  return (await readUserCache<TodoItem[]>(userId, 'todo'))?.data ?? [];
}

export async function saveTodoItems(userId: string, items: TodoItem[]): Promise<void> {
  await writeUserCache(userId, 'todo', items); // ✅ तुरंत local, ताकि UI कभी block ना हो
  await supabase.from('todos').upsert({ user_id: userId, items, updated_at: new Date().toISOString() });
}

export async function loadCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  try {
    const { data, error } = await supabase.from('calendar_events').select('events').eq('user_id', userId).maybeSingle();
    if (!error && data) {
      const events = (data.events as CalendarEvent[]) ?? [];
      await writeUserCache(userId, 'calendar', events);
      return events;
    }
  } catch {
    // network नहीं है — नीचे local cache पर fallback करो
  }
  return (await readUserCache<CalendarEvent[]>(userId, 'calendar'))?.data ?? [];
}

export async function saveCalendarEvents(userId: string, events: CalendarEvent[]): Promise<void> {
  await writeUserCache(userId, 'calendar', events); // ✅ तुरंत local, ताकि UI कभी block ना हो
  await supabase.from('calendar_events').upsert({ user_id: userId, events, updated_at: new Date().toISOString() });
}
