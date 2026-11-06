/**
 * Microservicio: ejecucion
 * Módulo: ejecucion (frontend, compartido)
 * Feature: Cerrar los modales al pulsar fuera (quick 261019-mcf)
 * Archivo: DialogoModalContext.ts
 * Responsabilidad: Los dos contextos del cierre de modales.
 *
 *     · `ContextoDialogoModal` lo publica cada `DialogoModal`: su `solicitarCierre` aplica la regla
 *       del fondo y de Escape (ocupado → nada; cambios → pregunta; si no → cierra).
 *     · `ContextoCierreRegistro` también lo publica cada `DialogoModal`, para el contenido que sabe
 *       algo que quien pinta el `<dialog>` no ve. El caso que lo motivó es `ModalContainer`: el
 *       `<dialog>` de los modales del registro es suyo y no del modal, así que el modal le DECLARA
 *       desde dentro si tiene cambios, si está enviando y, si cerrar exige algo más que `onClose`,
 *       con qué cerrar. Lo usa igual `ConfirmationDetail`, que lleva su envío por dentro.
 *
 *   Están aquí, y no en el `.tsx` del componente, para que Fast Refresh no pierda el estado.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-19
 */
import { createContext } from "react";

export interface ContextoDialogoModalValor {
  /** Pide el cierre aplicando la regla (ocupado → nada; cambios → pregunta; si no → cierra). */
  solicitarCierre: () => void;
}

export const ContextoDialogoModal =
  createContext<ContextoDialogoModalValor | null>(null);

/** Lo que una pieza del contenido declara al `DialogoModal` que la envuelve. */
export interface DeclaracionCierre {
  hayCambios: boolean;
  ocupado: boolean;
  /** Sustituye a `onClose` cuando cerrar tiene que hacer algo más (p. ej. refrescar la bandeja). */
  onCerrar?: () => void;
}

export interface ContextoCierreRegistroValor {
  /**
   * Declara (o con `null`, retira) lo de la pieza `id`. Puede haber VARIAS a la vez —un modal y el
   * `ConfirmationDetail` que lleva dentro, o el formulario de un paso y el modal que lo contiene—, y
   * se SUMAN: basta con que una diga «hay cambios» o «estoy enviando».
   */
  declarar: (id: string, declaracion: DeclaracionCierre | null) => void;
}

export const ContextoCierreRegistro =
  createContext<ContextoCierreRegistroValor | null>(null);
