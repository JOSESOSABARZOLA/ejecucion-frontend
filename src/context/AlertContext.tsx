/**
 * Microservicio: resolucion
 * Módulo: Alertas
 * Feature: Contexto global de alertas
 * Archivo: AlertContext.tsx
 * Responsabilidad: Proveer estado global de alertas y métodos para sincronización WebSocket + HTTP fallback
 * Desarrollador: Johan Freire
 * Fecha: 2026-05-18
 */

import {
  createContext,
  useState,
  type FC,
  type ReactNode,
  useCallback,
} from "react";
import type { IAlert } from "../interfaces/IAlert";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "polling";

interface AlertContextProps {
  // Estado
  alerts: IAlert[];
  totalAlerts: number;
  isConnected: boolean;
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  lastUpdate: Date | null;
  error: Error | null;

  // Actions
  setAlerts: (alerts: IAlert[]) => void;
  setTotalAlerts: (total: number) => void;
  setIsConnected: (connected: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (error: Error | null) => void;
  addAlert: (alert: IAlert) => void;
  removeAlert: (userAlertId: number) => void;
  markAlertAsRead: (userAlertId: number) => void;
  clearAlerts: () => void;
}

export const AlertContext = createContext<AlertContextProps | undefined>(
  undefined,
);

export const AlertProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Agrega una nueva alerta (evita duplicados por userAlertId)
   */
  const addAlert = useCallback((alert: IAlert) => {
    setAlerts((prevAlerts) => {
      const exists = prevAlerts.some((a) => a.ualeId === alert.ualeId);
      if (exists) {
        return prevAlerts;
      }
      return [alert, ...prevAlerts]; // Nueva alerta al inicio
    });
    setTotalAlerts((prev) => prev + 1);
    setLastUpdate(new Date());
  }, []);

  /**
   * Remueve una alerta por ID
   */
  const removeAlert = useCallback((userAlertId: number) => {
    setAlerts((prevAlerts) =>
      prevAlerts.filter((a) => a.ualeId !== userAlertId),
    );
    setTotalAlerts((prev) => Math.max(0, prev - 1));
    setLastUpdate(new Date());
  }, []);

  /**
   * Marca una alerta como leída 
   */
  const markAlertAsRead = useCallback((userAlertId: number) => {
    const updatedAlerts: IAlert[] = alerts.map((alert) =>
      alert.ualeId === userAlertId
        ? { ...alert, ualeRead: true, ualeReadAt: new Date() }
        : alert,
    );
    setAlerts( updatedAlerts );
    setLastUpdate(new Date());
  }, []);

  /**
   * Limpia todas las alertas
   */
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setTotalAlerts(0);
    setLastUpdate(new Date());
  }, []);

  const value: AlertContextProps = {
    alerts,
    totalAlerts,
    isConnected,
    isLoading,
    connectionStatus,
    lastUpdate,
    error,
    setAlerts,
    setTotalAlerts,
    setIsConnected,
    setIsLoading,
    setConnectionStatus,
    setError,
    addAlert,
    removeAlert,
    markAlertAsRead,
    clearAlerts,
  };

  return (
    <AlertContext.Provider value={value}>{children}</AlertContext.Provider>
  );
};
