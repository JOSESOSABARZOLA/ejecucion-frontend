/**
 * Microservicio: ejecucion
 * Módulo: toasts (frontend)
 * Feature: El aviso flotante como canal único del resultado de una acción (quick 261028-kmg)
 * Archivo: ToastProvider.tsx
 * Responsabilidad: La pila de avisos flotantes de toda la app y su ciclo de vida.
 *
 *   REGLA DE MENSAJES (quick 261028-kmg, decisión del usuario 2026-10-28; el detalle, en Alert.tsx):
 *   · Un error que pertenece a un CAMPO (validación, dato obligatorio, la clave de firma rechazada)
 *     se dice SOLO bajo ese campo, con el foco en él. No pasa por aquí.
 *   · El RESULTADO de una acción (éxito, error del servidor o de negocio) se dice SOLO aquí, con
 *     `useToast().addToast`. Nunca además en una caja en línea.
 *   · Error y advertencia se quedan hasta que el usuario los cierra («Cerrar aviso»); éxito e
 *     información se van solos (3 s por defecto). Lo decide el tipo, no la duración que pase quien
 *     llama.
 *   · El mismo aviso (tipo + texto + título) no se apila: el repetido sustituye al anterior.
 *   · Pila de 3: al superarla sale el más antiguo NO persistente; un error solo cae si la pila son
 *     todo persistentes.
 *   · Cada aviso efímero se cierra por su tiempo RESTANTE (`createdAt + duración − ahora`), así que
 *     un aviso nuevo no alarga la vida de los anteriores.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-28
 */
import React, { useState, useCallback, useEffect } from "react";
import { ToastContext } from "../context/ToastContext";
import type { Toast, ToastType } from "../interfaces/IToast";
import ToastContainer from "../components/toasts/ToastContainer";

interface ToastProviderProps {
  children: React.ReactNode;
}

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 3000; // 3 segundos

/** Tipos que se quedan hasta que el usuario los cierra. */
export const TIPOS_PERSISTENTES: ReadonlySet<ToastType> = new Set<ToastType>([
  "error",
  "warning",
]);

const mismoAviso = (a: Toast, b: Toast) =>
  a.type === b.type && a.message === b.message && a.title === b.title;

/**
 * Saca de la pila el que sobra: el más antiguo que NO es persistente y, solo si no hay ninguno, el
 * más antiguo de todos. La pila llega ordenada por entrada (el primero es el más antiguo).
 */
const desalojar = (pila: Toast[]): Toast[] => {
  if (pila.length <= MAX_TOASTS) return pila;
  const indice = pila.findIndex((t) => !t.persistente);
  const quitar = indice === -1 ? 0 : indice;
  return pila.filter((_, i) => i !== quitar);
};

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Añade un aviso a la pila
  const addToast = useCallback(
    (
      type: ToastType,
      message: string,
      title?: string,
      duration: number = DEFAULT_DURATION,
    ) => {
      const persistente = TIPOS_PERSISTENTES.has(type);
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type,
        message,
        title,
        duration: persistente ? undefined : duration,
        createdAt: Date.now(),
        persistente,
      };

      setToasts((prevToasts) =>
        // El repetido sale y el nuevo entra al final: vuelve a elevar el contenedor sobre el modal.
        desalojar([
          ...prevToasts.filter((t) => !mismoAviso(t, newToast)),
          newToast,
        ]),
      );
    },
    [],
  );

  // Quita un aviso por id
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  // Vacía la pila
  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Auto-cierre de los efímeros por su tiempo RESTANTE; los persistentes no programan nada.
  useEffect(() => {
    const efimeros = toasts.filter((t) => !t.persistente);
    if (efimeros.length === 0) return;

    const ahora = Date.now();
    const timers = efimeros.map((toast) => {
      const restante = Math.max(
        0,
        toast.createdAt + (toast.duration ?? DEFAULT_DURATION) - ahora,
      );
      return setTimeout(() => removeToast(toast.id), restante);
    });

    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
    };
  }, [toasts, removeToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    clearAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};
