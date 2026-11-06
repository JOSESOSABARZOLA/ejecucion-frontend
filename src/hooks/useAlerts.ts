/**
 * Microservicio: resolucion
 * Módulo: Alertas
 * Feature: Hook para consumir contexto de alertas
 * Archivo: useAlerts.ts
 * Responsabilidad: Wrapper custom hook para acceder al AlertContext
 * Desarrollador: Johan Freire
 * Fecha: 2026-05-18
 */

import { useContext } from "react";
import { AlertContext } from "../context/AlertContext";

/**
 * Hook para consumir AlertContext
 * Debe ser usado dentro de un árbol que tenga AlertProvider
 *
 * @throws Error si se usa fuera de AlertProvider
 */
export const useAlerts = () => {
  const context = useContext(AlertContext);

  if (!context) {
    throw new Error("useAlerts debe ser usado dentro de AlertProvider");
  }

  return context;
};
