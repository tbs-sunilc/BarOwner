import type { PourRequestDto } from '@/lib/api-client';
import type { PourRequestState, ServedPourLog, TabletState } from '@/lib/tablet-state';
import type { QueueUpdatedEvent, QueueItemDto, ServedItemDto } from '@/hooks/usePourHub';

export function pourDtoToQueueState(row: PourRequestDto): PourRequestState {
  const waitTime = toWaitLabel(row.createdAtUtc);
  return {
    id: row.id,
    tableId: row.barTableId ?? row.sessionId,
    customer: row.userDisplayName ?? 'Guest',
    bottle: [row.bottleBrandName, row.bottleProductName].filter(Boolean).join(' ') || 'Unknown bottle',
    walletBalance: row.remainingMlAfterServe ?? 0,
    requestedAmount: row.requestedMl,
    waitTime,
    urgent: isUrgentWait(waitTime),
  };
}

export function pourDtoToQueueItem(row: PourRequestDto): QueueItemDto {
  const q = pourDtoToQueueState(row);
  return {
    id: q.id,
    tableId: q.tableId,
    customerName: q.customer,
    bottleName: q.bottle,
    walletBalanceMl: q.walletBalance,
    requestedMl: q.requestedAmount,
    waitTime: q.waitTime,
    isUrgent: Boolean(q.urgent),
    walletId: row.walletId,
  };
}

export function queueItemToQueueState(item: QueueItemDto): PourRequestState {
  return {
    id: item.id,
    tableId: item.tableId,
    customer: item.customerName,
    bottle: item.bottleName,
    walletBalance: item.walletBalanceMl,
    requestedAmount: item.requestedMl,
    waitTime: item.waitTime,
    urgent: item.isUrgent,
  };
}

export function servedItemToLog(item: ServedItemDto): ServedPourLog {
  return {
    time: item.time,
    table: item.table,
    customer: item.customer,
    bottle: item.bottle,
    amount: item.amount,
  };
}

export function pourDtoToServedLog(row: PourRequestDto): ServedPourLog {
  const servedMl = row.servedMl ?? 0;
  return {
    time: toClockLabel(row.servedAtUtc ?? row.createdAtUtc),
    table: row.barTableId ? `T${row.barTableId}` : `S${row.sessionId}`,
    customer: row.userDisplayName ?? 'Guest',
    bottle: [row.bottleBrandName, row.bottleProductName].filter(Boolean).join(' ') || 'Unknown bottle',
    amount: `${servedMl}ml`,
  };
}

/** Derive tonight shift stats from served pour rows. */
export function buildShiftStatsFromServed(
  served: PourRequestDto[],
  prev: TabletState['shiftStats'],
): TabletState['shiftStats'] {
  const poursServed = served.length;
  const totalMlServed = served.reduce((sum, row) => sum + (row.servedMl ?? 0), 0);
  const walletDeductions = served.filter(row => row.walletTransactionId != null).length;
  const uniqueCustomers = new Set(served.map(row => row.userId)).size;

  return {
    ...prev,
    poursServed,
    totalMlServed,
    walletDeductions,
    uniqueCustomers,
  };
}

export function buildShiftStatsFromServedItems(
  served: ServedItemDto[],
  prev: TabletState['shiftStats'],
): TabletState['shiftStats'] {
  const poursServed = served.length;
  const totalMlServed = served.reduce((sum, row) => sum + row.servedMl, 0);
  return {
    ...prev,
    poursServed,
    totalMlServed,
    walletDeductions: poursServed,
    uniqueCustomers: prev.uniqueCustomers,
  };
}

export function applyQueueUpdatedToState(prev: TabletState, evt: QueueUpdatedEvent): TabletState {
  return {
    ...prev,
    pourQueue: evt.pendingRequests.map(queueItemToQueueState),
    servedPours: evt.servedTonight.map(servedItemToLog),
    shiftStats: buildShiftStatsFromServedItems(evt.servedTonight, prev.shiftStats),
  };
}

export function applyPourApiToState(
  prev: TabletState,
  pending: PourRequestDto[],
  served: PourRequestDto[],
): TabletState {
  return {
    ...prev,
    pourQueue: pending.map(pourDtoToQueueState),
    servedPours: served.map(pourDtoToServedLog),
    shiftStats: buildShiftStatsFromServed(served, prev.shiftStats),
  };
}

function toWaitLabel(createdAtUtc: string): string {
  const createdAt = Date.parse(createdAtUtc);
  if (Number.isNaN(createdAt)) return 'Just now';
  const diffMs = Date.now() - createdAt;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function isUrgentWait(waitTime: string): boolean {
  if (waitTime === 'Just now') return false;
  const match = /^(\d+)\s+min$/.exec(waitTime);
  if (!match) return false;
  return Number(match[1]) >= 4;
}

function toClockLabel(utcIso: string): string {
  const dt = new Date(utcIso);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
