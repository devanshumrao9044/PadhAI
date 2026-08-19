import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";

type TargetType = 'user' | 'all' | 'level';
type RequestBody = {
  title?: unknown;
  body?: unknown;
  targetType?: unknown;
  targetUserId?: unknown;
  targetLevel?: unknown;
};

type Recipient = { id: string };

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { notificationId: string };
};

type DeviceRow = { expo_push_token: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= maxLength ? text : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (request.method !== 'POST' && request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration is incomplete' }, 500);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
  const accessToken = authorization.slice('Bearer '.length).trim();

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  const senderId = authData.user?.id;
  if (authError || !senderId) return json({ error: 'Invalid session' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: adminRole, error: roleError } = await adminClient
    .from('notification_admins')
    .select('role')
    .eq('user_id', senderId)
    .maybeSingle();
  if (roleError || !adminRole || !['owner', 'admin'].includes(adminRole.role)) {
    return json({ error: 'Owner/Admin permission required' }, 403);
  }

  if (request.method === 'GET') {
    const { data: recipients, error: recipientsError } = await adminClient
      .from('users')
      .select('id,name,email,level')
      .order('name', { ascending: true })
      .limit(1000);
    if (recipientsError) return json({ error: 'Could not load recipient options' }, 500);
    return json({ recipients: recipients ?? [] });
  }

  let payload: RequestBody;
  try {
    payload = await request.json() as RequestBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const title = cleanText(payload.title, 100);
  const body = cleanText(payload.body, 500);
  const targetType = payload.targetType;
  if (!title || !body || (targetType !== 'user' && targetType !== 'all' && targetType !== 'level')) {
    return json({ error: 'Title, body, and a valid target are required' }, 400);
  }

  const targetUserId = targetType === 'user' && isUuid(payload.targetUserId) ? payload.targetUserId : null;
  const targetLevel = targetType === 'level' && Number.isInteger(payload.targetLevel) ? Number(payload.targetLevel) : null;
  if (targetType === 'user' && !targetUserId) return json({ error: 'A valid target user is required' }, 400);
  if (targetType === 'level' && (targetLevel === null || targetLevel < 1 || targetLevel > 10)) return json({ error: 'A valid target level is required' }, 400);

  let recipients: Recipient[] = [];
  if (targetType === 'user') {
    const { data, error } = await adminClient.from('users').select('id').eq('id', targetUserId).limit(1);
    if (error) return json({ error: 'Could not resolve target user' }, 500);
    recipients = (data ?? []) as Recipient[];
  } else if (targetType === 'level') {
    const { data, error } = await adminClient.from('users').select('id').eq('level', targetLevel).limit(10000);
    if (error) return json({ error: 'Could not resolve target level' }, 500);
    recipients = (data ?? []) as Recipient[];
  } else {
    const { data, error } = await adminClient.from('users').select('id').limit(10000);
    if (error) return json({ error: 'Could not resolve recipients' }, 500);
    recipients = (data ?? []) as Recipient[];
  }

  if (recipients.length === 0) return json({ error: 'No recipients matched this target' }, 400);

  const { data: message, error: messageError } = await adminClient
    .from('notification_messages')
    .insert({
      sender_id: senderId,
      target_type: targetType as TargetType,
      target_user_id: targetUserId,
      target_level: targetLevel,
      title,
      body,
    })
    .select('id')
    .single();
  if (messageError || !message) return json({ error: 'Could not save notification' }, 500);

  const rows = recipients.map(recipient => ({
    message_id: message.id,
    user_id: recipient.id,
    title,
    body,
  }));
  for (const batch of chunk(rows, 500)) {
    const { error } = await adminClient.from('user_notifications').insert(batch);
    if (error) return json({ error: 'Notification saved but recipient delivery could not be prepared', messageId: message.id }, 500);
  }

  const recipientIds = recipients.map(recipient => recipient.id);
  const { data: devices } = await adminClient
    .from('notification_devices')
    .select('expo_push_token')
    .in('user_id', recipientIds)
    .eq('enabled', true)
    .limit(10000);
  const pushMessages: ExpoPushMessage[] = (devices as DeviceRow[] ?? []).map(device => ({
    to: device.expo_push_token,
    title,
    body,
    sound: 'default',
    data: { notificationId: message.id },
  }));

  let sent = 0;
  let failed = 0;
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  for (const batch of chunk(pushMessages, 100)) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        failed += batch.length;
        continue;
      }
      const result = await response.json() as { data?: Array<{ status?: string }> };
      for (const ticket of result.data ?? []) ticket.status === 'ok' ? sent++ : failed++;
    } catch {
      failed += batch.length;
    }
  }

  return json({
    messageId: message.id,
    recipientCount: recipients.length,
    deviceCount: pushMessages.length,
    sent,
    failed,
  });
}

Deno.serve(async (request: Request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error('send-admin-notification failed', error);
    return json({ error: 'Internal notification service error' }, 500);
  }
});
