import NetInfo from '@react-native-community/netinfo';
import { getItem, removeItem, setItem } from '@/features/core/services/storage';
import { supabase } from '@/features/core/services/supabase';

export type OfflineFocusQueueStatus = 'ready_to_sync' | 'syncing' | 'failed' | 'conflict';

export type OfflineFocusQueueItem = {
  sessionId: string;
  userId: string;
  subjectId: string | null;
  chapterId: string | null;
  studyGroupId: string | null;
  plannedMinutes: number;
  actualMinutes: number;
  elapsedSeconds: number;
  completed: boolean;
  broken: boolean;
  startedAt: string;
  endedAt: string;
  clockAnomaly: boolean;
  isRecovery: boolean;
  recoveryLostStreak: number | null;
  comebackBonus: number;
  sequence: number;
  status: OfflineFocusQueueStatus;
  attempts: number;
  lastError: string | null;
  conflictCode: string | null;
};

export type OfflineFocusSyncResult = {
  sessionId: string;
  status: 'accepted' | 'duplicate' | 'conflict' | 'failed';
  conflictCode?: string | null;
  message?: string | null;
  verifiedMinutes?: number;
  xpEarned?: number;
  referralXpAwarded?: number;
};

const queueKey = (userId: string) => `padhai:offline-focus-queue:v1:${userId}`;
const queueLocks = new Set<string>();

async function readQueue(userId: string): Promise<OfflineFocusQueueItem[]> {
  const queue = (await getItem<OfflineFocusQueueItem[]>(queueKey(userId))) ?? [];
  return queue.map(item => item.status === 'syncing'
    ? { ...item, status: 'ready_to_sync', lastError: 'Sync was interrupted. Retrying.' }
    : item,
  );
}

async function writeQueue(userId: string, queue: OfflineFocusQueueItem[]): Promise<void> {
  if (queue.length === 0) {
    await removeItem(queueKey(userId));
    return;
  }
  await setItem(queueKey(userId), queue);
}

export async function getOfflineFocusQueue(userId: string): Promise<OfflineFocusQueueItem[]> {
  const queue = await readQueue(userId);
  await writeQueue(userId, queue);
  return queue;
}

export async function enqueueOfflineFocusSession(item: Omit<OfflineFocusQueueItem, 'sequence' | 'status' | 'attempts' | 'lastError' | 'conflictCode'>): Promise<void> {
  const queue = await readQueue(item.userId);
  if (queue.some(entry => entry.sessionId === item.sessionId)) return;
  const sequence = queue.reduce((max, entry) => Math.max(max, entry.sequence), 0) + 1;
  await writeQueue(item.userId, [
    ...queue,
    {
      ...item,
      sequence,
      status: 'ready_to_sync',
      attempts: 0,
      lastError: null,
      conflictCode: null,
    },
  ]);
}

export async function clearOfflineFocusQueue(userId: string): Promise<void> {
  await removeItem(queueKey(userId));
}

export async function isNetworkReachable(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

function isConflictResponse(data: any): boolean {
  return data?.accepted === false && typeof data?.conflict_code === 'string';
}

export async function syncOfflineFocusQueue(userId: string): Promise<OfflineFocusSyncResult[]> {
  if (queueLocks.has(userId) || !(await isNetworkReachable())) return [];
  queueLocks.add(userId);
  const results: OfflineFocusSyncResult[] = [];

  try {
    let queue = await readQueue(userId);
    const ordered = queue
      .filter(item => item.status === 'ready_to_sync' || item.status === 'failed')
      .sort((a, b) => a.sequence - b.sequence);

    for (const item of ordered) {
      if (!(await isNetworkReachable())) break;
      queue = await readQueue(userId);
      await writeQueue(userId, queue.map(entry => entry.sessionId === item.sessionId
        ? { ...entry, status: 'syncing', attempts: entry.attempts + 1, lastError: null }
        : entry,
      ));

      const { data, error } = await supabase.rpc('sync_offline_focus_session', {
        p_session_id: item.sessionId,
        p_subject_id: item.subjectId,
        p_chapter_id: item.chapterId,
        p_study_group_id: item.studyGroupId,
        p_planned_minutes: item.plannedMinutes,
        p_actual_minutes: item.actualMinutes,
        p_elapsed_seconds: item.elapsedSeconds,
        p_completed: item.completed,
        p_broken: item.broken,
        p_started_at: item.startedAt,
        p_ended_at: item.endedAt,
        p_clock_anomaly: item.clockAnomaly,
        p_is_recovery: item.isRecovery,
        p_recovery_lost_streak: item.recoveryLostStreak,
        p_comeback_bonus: item.comebackBonus,
      });

      if (error) {
        const latest = await readQueue(userId);
        await writeQueue(userId, latest.map(entry => entry.sessionId === item.sessionId
          ? { ...entry, status: 'failed', lastError: error.message }
          : entry,
        ));
        results.push({ sessionId: item.sessionId, status: 'failed', message: error.message });
        break;
      }

      if (isConflictResponse(data)) {
        const latest = await readQueue(userId);
        await writeQueue(userId, latest.map(entry => entry.sessionId === item.sessionId
          ? {
              ...entry,
              status: 'conflict',
              conflictCode: data.conflict_code,
              lastError: data.message ?? 'This session could not be verified.',
            }
          : entry,
        ));
        results.push({
          sessionId: item.sessionId,
          status: 'conflict',
          conflictCode: data.conflict_code,
          message: data.message,
        });
        continue;
      }

      if (data?.accepted === true) {
        const latest = await readQueue(userId);
        await writeQueue(userId, latest.filter(entry => entry.sessionId !== item.sessionId));
        results.push({
          sessionId: item.sessionId,
          status: data.duplicate ? 'duplicate' : 'accepted',
          verifiedMinutes: Number(data.verified_minutes ?? item.actualMinutes),
          xpEarned: Number(data.xp_earned ?? 0),
          referralXpAwarded: Number(data.referral_xp_awarded ?? 0),
        });
        continue;
      }

      const latest = await readQueue(userId);
      await writeQueue(userId, latest.map(entry => entry.sessionId === item.sessionId
        ? { ...entry, status: 'failed', lastError: 'Unexpected sync response.' }
        : entry,
      ));
      results.push({ sessionId: item.sessionId, status: 'failed', message: 'Unexpected sync response.' });
      break;
    }
  } finally {
    queueLocks.delete(userId);
  }

  return results;
}

export function subscribeToOfflineFocusReconnect(
  userId: string,
  onSynced?: (results: OfflineFocusSyncResult[]) => void,
): () => void {
  const subscription = NetInfo.addEventListener(state => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    if (online) void syncOfflineFocusQueue(userId).then(results => {
      if (results.length > 0) onSynced?.(results);
    });
  });
  return () => subscription();
}
