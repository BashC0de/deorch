'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth-provider';
import { useQueryClient } from '@tanstack/react-query';
import type { WsMessage } from '@/lib/types/ws';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:8000';

interface WsState {
  isConnected: boolean;
  lastMessage: WsMessage | null;
}

const WsContext = createContext<WsState>({ isConnected: false, lastMessage: null });

export function WsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const ws = new WebSocket(`${WS_URL}/ws/dashboard`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          handleMessage(msg, ws);
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        if (!destroyed) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
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
          // Start heartbeat
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
          }, 30_000);
          break;

        case 'auth_error':
          ws.close();
          break;

        case 'approval_request':
          void queryClient.invalidateQueries({ queryKey: ['approvals'] });
          setLastMessage(msg);
          // Browser notification
          if (Notification.permission === 'granted') {
            new Notification('DeOrch: Approval Required', {
              body: String(msg.payload['action_summary'] ?? 'Action needs approval'),
            });
          }
          break;

        case 'device_connected':
        case 'device_disconnected':
          void queryClient.invalidateQueries({ queryKey: ['devices'] });
          break;

        case 'session_started':
        case 'session_ended':
          void queryClient.invalidateQueries({ queryKey: ['sessions'] });
          break;

        case 'agent_event':
          void queryClient.invalidateQueries({ queryKey: ['sessions'] });
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

    return () => {
      destroyed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      wsRef.current?.close();
    };
  }, [isAuthenticated, token, queryClient]);

  return (
    <WsContext.Provider value={{ isConnected, lastMessage }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs(): WsState {
  return useContext(WsContext);
}
