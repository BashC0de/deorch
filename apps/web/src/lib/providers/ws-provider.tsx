'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './auth-provider';
import { useQueryClient } from '@tanstack/react-query';
import type { WsMessage } from '@/lib/types/ws';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:8000';
const MAX_RECONNECT_DELAY = 16_000;
const HEARTBEAT_INTERVAL = 30_000;

interface WsState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastMessage: WsMessage | null;
}

const WsContext = createContext<WsState>({ isConnected: false, isReconnecting: false, lastMessage: null });

export function WsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const destroyedRef = useRef(false);

  const reconcile = useCallback(() => {
    // Refetch all data to reconcile after reconnect
    void queryClient.invalidateQueries({ queryKey: ['devices'] });
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['approvals'] });
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    destroyedRef.current = false;

    function connect() {
      if (destroyedRef.current) return;

      const ws = new WebSocket(`${WS_URL}/ws/dashboard`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsReconnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          handleMessage(msg, ws);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        if (!destroyedRef.current) {
          setIsReconnecting(true);
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s max
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), MAX_RECONNECT_DELAY);
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => ws.close();
    }

    function handleMessage(msg: WsMessage, ws: WebSocket) {
      switch (msg.type) {
        case 'auth_required':
          ws.send(
            JSON.stringify({
              type: 'auth_token',
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              payload: { token },
            }),
          );
          break;

        case 'auth_ok':
          setIsConnected(true);
          // Reset reconnect counter on successful auth
          if (reconnectAttemptRef.current > 0) {
            reconcile();
          }
          reconnectAttemptRef.current = 0;
          // Start heartbeat
          if (pingTimerRef.current) clearInterval(pingTimerRef.current);
          pingTimerRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'ping',
                  id: crypto.randomUUID(),
                  timestamp: new Date().toISOString(),
                  payload: {},
                }),
              );
            }
          }, HEARTBEAT_INTERVAL);
          break;

        case 'auth_error':
          ws.close();
          break;

        case 'approval_request':
          void queryClient.invalidateQueries({ queryKey: ['approvals'] });
          setLastMessage(msg);
          // Browser notification
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('DeOrch: Approval Required', {
              body: String(msg.payload['action_summary'] ?? 'Action needs approval'),
              tag: `approval-${String(msg.payload['request_id'] ?? '')}`,
            });
          }
          break;

        case 'device_connected':
        case 'device_disconnected':
        case 'device_registered':
          void queryClient.invalidateQueries({ queryKey: ['devices'] });
          break;

        case 'session_started':
        case 'session_ended':
          void queryClient.invalidateQueries({ queryKey: ['sessions'] });
          break;

        case 'agent_event':
          void queryClient.invalidateQueries({ queryKey: ['sessions'] });
          break;

        case 'service_health_changed':
          void queryClient.invalidateQueries({ queryKey: ['services'] });
          void queryClient.invalidateQueries({ queryKey: ['project-health'] });
          break;

        case 'test_run_completed':
          void queryClient.invalidateQueries({ queryKey: ['test-runs'] });
          void queryClient.invalidateQueries({ queryKey: ['project-health'] });
          break;

        case 'git_snapshot_updated':
          void queryClient.invalidateQueries({ queryKey: ['git-snapshots'] });
          void queryClient.invalidateQueries({ queryKey: ['project-health'] });
          break;

        case 'build_completed':
          void queryClient.invalidateQueries({ queryKey: ['build-results'] });
          void queryClient.invalidateQueries({ queryKey: ['project-health'] });
          break;

        case 'pong':
          break;
      }
    }

    connect();

    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    // Handle page visibility — reconnect when page becomes visible
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectAttemptRef.current = 0;
          connect();
        }
      }
    }

    // Handle network online/offline
    function handleOnline() {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectAttemptRef.current = 0;
      connect();
    }

    function handleOffline() {
      setIsConnected(false);
      setIsReconnecting(true);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      wsRef.current?.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated, token, queryClient, reconcile]);

  return (
    <WsContext.Provider value={{ isConnected, isReconnecting, lastMessage }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs(): WsState {
  return useContext(WsContext);
}
