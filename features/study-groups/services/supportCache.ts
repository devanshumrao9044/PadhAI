import { readUserCache, writeUserCache } from '@/features/core/services/cache';
import type { StudyGroupReport, StudyGroupTicket } from './studyGroups';

export type LocalSupportHistory = {
  tickets: StudyGroupTicket[];
  reports: StudyGroupReport[];
  hiddenTicketIds: string[];
  hiddenReportIds: string[];
};

const emptyHistory = (): LocalSupportHistory => ({
  tickets: [],
  reports: [],
  hiddenTicketIds: [],
  hiddenReportIds: [],
});

export async function readSupportHistory(userId: string): Promise<LocalSupportHistory> {
  const cached = await readUserCache<Partial<LocalSupportHistory>>(userId, 'supportTickets');
  const data = cached?.data ?? {};
  return {
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    reports: Array.isArray(data.reports) ? data.reports : [],
    hiddenTicketIds: Array.isArray(data.hiddenTicketIds) ? data.hiddenTicketIds.map(String) : [],
    hiddenReportIds: Array.isArray(data.hiddenReportIds) ? data.hiddenReportIds.map(String) : [],
  };
}

export async function writeSupportHistory(userId: string, history: LocalSupportHistory): Promise<void> {
  await writeUserCache(userId, 'supportTickets', {
    tickets: history.tickets.slice(0, 100),
    reports: history.reports.slice(0, 100),
    hiddenTicketIds: Array.from(new Set(history.hiddenTicketIds)).slice(-100),
    hiddenReportIds: Array.from(new Set(history.hiddenReportIds)).slice(-100),
  });
}

export async function hideSupportTicket(userId: string, ticketId: string): Promise<LocalSupportHistory> {
  const history = await readSupportHistory(userId);
  const next = {
    ...history,
    hiddenTicketIds: [...history.hiddenTicketIds, ticketId],
  };
  await writeSupportHistory(userId, next);
  return next;
}

export async function hideSupportReport(userId: string, reportId: string): Promise<LocalSupportHistory> {
  const history = await readSupportHistory(userId);
  const next = {
    ...history,
    hiddenReportIds: [...history.hiddenReportIds, reportId],
  };
  await writeSupportHistory(userId, next);
  return next;
}

export function filterVisibleSupportHistory(history: LocalSupportHistory): LocalSupportHistory {
  const hiddenTickets = new Set(history.hiddenTicketIds);
  const hiddenReports = new Set(history.hiddenReportIds);
  return {
    ...history,
    tickets: history.tickets.filter(ticket => !hiddenTickets.has(ticket.id)),
    reports: history.reports.filter(report => !hiddenReports.has(report.id)),
  };
}

export { emptyHistory };
