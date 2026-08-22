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
  xpDeducted?: number;
  referralXpAwarded?: number;
  newXpTotal?: number;
  newStreak?: number;
};

export type OfflineFocusSettlementInput = Omit<OfflineFocusQueueItem, 'sequence' | 'status' | 'attempts' | 'lastError' | 'conflictCode'>;

export async function submitOfflineFocusSession(input: Pick<OfflineFocusQueueItem, 'sessionId' | 'subjectId' | 'chapterId' | 'studyGroupId' | 'plannedMinutes' | 'actualMinutes' | 'elapsedSeconds' | 'completed' | 'broken' | 'startedAt' | 'endedAt' | 'clockAnomaly' | 'isRecovery' | 'recoveryLostStreak' | 'comebackBonus'>): Promise<{ data: any; error: any }> {
  return supabase.rpc('sync_offline_focus_session', {
    p_session_id: input.sessionId,
    p_subject_id: input.subjectId,
    p_chapter_id: input.chapterId,
    p_study_group_id: input.studyGroupId,
    p_planned_minutes: input.plannedMinutes,
    p_actual_minutes: input.actualMinutes,
    p_elapsed_seconds: input.elapsedSeconds,
    p_completed: input.completed,
    p_broken: input.broken,
    p_started_at: input.startedAt,
    p_ended_at: input.endedAt,
    p_clock_anomaly: input.clockAnomaly,
    p_is_recovery: input.isRecovery,
    p_recovery_lost_streak: input.recoveryLostStreak,
    p_comeback_bonus: input.comebackBonus,
  });
}

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

export async function enqueueOfflineFocusSession(item: OfflineFocusSettlementInput): Promise<void> {
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

      const { data, error } = await submitOfflineFocusSession(item);

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
          xpDeducted: Number(data.xp_deducted ?? 0),
          referralXpAwarded: Number(data.referral_xp_awarded ?? 0),
          newXpTotal: Number.isFinite(Number(data.new_xp_total)) ? Number(data.new_xp_total) : undefined,
          newStreak: Number.isFinite(Number(data.new_streak)) ? Number(data.new_streak) : undefined,
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
