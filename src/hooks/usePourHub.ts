'use client';

import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { useEffect, useRef, useState } from 'react';

/**
 * SignalR hook for the bartender tablet. Subscribes to the `bar_{barId}`
 * group on <c>/hubs/pour</c> and surfaces three event streams:
 *   * onNewPourRequest  — SC-21 tile flips to "Pour Requested".
 *   * onPourConfirmed   — tile reverts to Active after bartender serves.
 *   * onPourCancelled   — tile reverts to Active after reject/cancel.
 *
 * Connection lifecycle: builds with automatic reconnect on mount, tears down
 * on unmount. Access token is pulled from sessionStorage at connect time
 * (matches the pattern used by api-client.ts), then passed via the
 * `access_token` query string which Program.cs honours for hub paths.
 */

export type NewPourRequestEvent = {
  pourRequestId: number;
  barId: number;
  sessionId: number;
  walletId: number;
  userId: number;
  requestedMl: number;
  createdAtUtc: string;
  userNotes: string | null;
  userDisplayName: string | null;
  bottleBrandName: string | null;
  bottleProductName: string | null;
  remainingMlBeforeServe: number | null;
};

export type PourConfirmedEvent = {
  pourRequestId: number;
  walletId: number;
  servedMl: number;
  newBalanceMl: number;
  walletStatus: string;
  walletTransactionId: number;
  servedAtUtc: string;
};

export type PourCancelledEvent = {
  pourRequestId: number;
  status: 'Cancelled' | 'Rejected';
  reason: string | null;
  cancelledAtUtc: string;
};

export type PourHubHandlers = {
  onNewPourRequest?: (evt: NewPourRequestEvent) => void;
  onPourConfirmed?: (evt: PourConfirmedEvent) => void;
  onPourCancelled?: (evt: PourCancelledEvent) => void;
};

const HUB_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://192.168.1.161:5000';

export function usePourHub(barId: number | null, handlers: PourHubHandlers) {
  const [connectionState, setConnectionState] = useState<HubConnectionState>(
    HubConnectionState.Disconnected,
  );
  const connectionRef = useRef<HubConnection | null>(null);
  // Ref lets handlers mutate across renders without forcing reconnect.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (barId == null) return;

    const token = typeof window !== 'undefined'
      ? window.sessionStorage.getItem('sipsave-barowner-access-token')
      : null;
    if (!token) {
      setConnectionState(HubConnectionState.Disconnected);
      return;
    }

    const conn = new HubConnectionBuilder()
      .withUrl(`${HUB_BASE}/hubs/pour`, { accessTokenFactory: () => token })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 2_000 })
      .configureLogging(LogLevel.Warning)
      .build();

    conn.on('NewPourRequest', (evt: NewPourRequestEvent) =>
      handlersRef.current.onNewPourRequest?.(evt));
    conn.on('PourConfirmed', (evt: PourConfirmedEvent) =>
      handlersRef.current.onPourConfirmed?.(evt));
    conn.on('PourCancelled', (evt: PourCancelledEvent) =>
      handlersRef.current.onPourCancelled?.(evt));

    conn.onreconnecting(() => setConnectionState(HubConnectionState.Reconnecting));
    conn.onreconnected(async () => {
      setConnectionState(HubConnectionState.Connected);
      try { await conn.invoke('JoinBarGroup', barId); } catch { /* ignore */ }
    });
    conn.onclose(() => setConnectionState(HubConnectionState.Disconnected));

    (async () => {
      try {
        await conn.start();
        await conn.invoke('JoinBarGroup', barId);
        setConnectionState(HubConnectionState.Connected);
      } catch (err) {
        console.warn('PourHub connect failed', err);
        setConnectionState(HubConnectionState.Disconnected);
      }
    })();

    connectionRef.current = conn;
    return () => {
      connectionRef.current = null;
      conn.stop().catch(() => undefined);
    };
  }, [barId]);

  return { connectionState };
}
