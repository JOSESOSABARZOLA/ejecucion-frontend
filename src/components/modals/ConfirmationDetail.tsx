/**
 * Microservicio: Resolución Frontend
 * Módulo: N/A
 * Feature: Modal de detalle de confirmación
 * Archivo: ConfirmationDetail.tsx
 * Responsabilidad: Componente de modal genérico para mostrar detalles y confirmar acciones críticas (envío a revisión, sorteo, etc.)
 * Desarrollador: Johan Freire
 * Fecha: 2026-04-10
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: `message` ya no se pinta en una caja;
 *   se dice una vez en el aviso flotante y el botón de confirmar sigue apagado mientras exista)
 */

import React, { useEffect, useRef, useState } from "react";
import Loading from "../common/Loading";
import { useCierreModal } from "../../hooks/useCierreModal";
import { useToast } from "../../hooks/useToast";
import type { ToastType } from "../../interfaces/IToast";
import { DatetimeUtil } from "../../utils/datetime.util";

// export const MODAL_KEY = "confirmation" as const;

/**
 * Props para el modal de confirmación genérico.
 *
 * PATRÓN DE RESPONSABILIDADES (regla de mensajes, quick 261028-kmg — ver Alert.tsx):
 * - Este componente es agnóstico. Si el padre pone `message`, se dice UNA vez en el aviso flotante
 *   (no en una caja) y el botón de confirmar queda apagado hasta que el padre lo limpie.
 * - El PADRE es responsable de:
 *   1. Ejecutar la lógica en `onConfirm()`
 *   2. Interpretar la respuesta del servicio
 *   3. Poner `message` cuando falla (el modal sigue abierto y el reintento, bloqueado); NO emitir
 *      además su propio aviso con el mismo texto: saldría dos veces
 *   4. Llamar `onClose()` SOLO si la operación fue exitosa
 * - Un error de CAMPO (p. ej. la clave de firma rechazada) NO va por `message`: se dice bajo el
 *   campo, con el foco, por la ranura `children`.
 *
 * EJEMPLO DE FLUJO:
 * - Usuario hace click en confirmar → `handleConfirm()` en ConfirmationDetail dispara `onConfirm()`
 * - `onConfirm()` (del padre) intenta operación
 * - Si ERROR: padre actualiza `setMessage(error)` → aviso flotante, modal permanece abierto
 * - Si ÉXITO: padre llama `onClose()` → cierra modal
 *
 * VENTAJAS:
 * - Lógica centralizada en el padre que conoce su dominio
 * - Modal reutilizable para cualquier tipo de confirmación
 * - Fácil de testear (padre y modal son independientes)
 */
interface ModalConfirmationProps {
  // Textos del header
  headerKicker: string;
  headerTitle: string;

  // Descripciones
  statusCopy: string;
  descriptionCopy: string;

  // Datos a mostrar (labels dinámicos)
  informationData: Record<string, string | number | Date>;

  /**
   * Callback para ejecutar la acción de confirmación.
   * El PADRE es responsable de interpretar la respuesta y manejar errores.
   * Debe actualizar `message` prop si hay error (para mantener modal abierto).
   * El padre llama `onClose()` SOLO si éxito confirmado.
   */
  onConfirm: () => Promise<void>;

  /**
   * Cierra el modal.
   * El PADRE decide CUÁNDO llamarla (típicamente: solo tras éxito en `onConfirm()`)
   */
  onClose: () => void;

  /**
   * Resultado a decir (error, warning, success, info). El PADRE lo pone según la respuesta de
   * `onConfirm()`. Mientras exista, el botón de confirmar está apagado; su texto se dice UNA vez por
   * contenido en el aviso flotante (un objeto nuevo con el mismo texto no repite el aviso; si el
   * padre lo limpia y vuelve a ponerlo, sí). No se pinta en el modal.
   */
  message?: {
    variant: ToastType;
    message: string;
  };

  // Textos de botones (opcionales con valores por defecto)
  cancelButtonText?: string;
  confirmButtonText?: string;
  confirmButtonLoadingText?: string;

  /**
   * Contenido EXTRA que se dibuja bajo la ficha de datos y encima de las acciones.
   *
   * Existe para un caso concreto (quick 260813-b4t): pedir la clave del certificado justo donde se
   * confirma la firma. La alternativa —duplicar el modal entero en cada pantalla que firma— habría
   * multiplicado por cuatro el copy y las precauciones sobre esa clave.
   */
  children?: React.ReactNode;

  /**
   * Bloquea el botón de confirmar sin cambiar su texto. Lo usa el padre cuando falta un dato que él
   * gobierna (p. ej. la clave del certificado, que es obligatoria si el firmador está encendido).
   */
  confirmDisabled?: boolean;
}

const ConfirmationDetail: React.FC<ModalConfirmationProps> = ({
  headerKicker,
  headerTitle,
  statusCopy,
  descriptionCopy,
  informationData,
  onConfirm,
  onClose,
  message,
  cancelButtonText = "Cancelar",
  confirmButtonText = "Confirmar",
  confirmButtonLoadingText = "Confirmando...",
  children,
  confirmDisabled = false,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const { addToast } = useToast();

  // El mensaje del padre va al aviso flotante una vez por CONTENIDO: la clave es primitiva, así que
  // un objeto nuevo con el mismo texto, el doble montaje de StrictMode o un re-render en bucle no lo
  // repiten. Cuando el mensaje desaparece la clave vuelve a null y el mismo fallo, si se repite tras
  // un nuevo intento, se vuelve a decir.
  const variante = message?.variant;
  const texto = message?.message ? message.message : null;
  const ultimoAvisoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!variante || !texto) {
      ultimoAvisoRef.current = null;
      return;
    }
    const clave = `${variante}|${texto}`;
    if (ultimoAvisoRef.current === clave) return;
    ultimoAvisoRef.current = clave;
    addToast(variante, texto);
  }, [variante, texto, addToast]);

  // Cierre al pulsar fuera (quick 261019-mcf): el diálogo que la envuelve cierra por el mismo
  // `onClose` que el aspa y «Cancelar», y mientras se confirma no cierra: el envío vive aquí dentro
  // y quien pinta el `<dialog>` no lo ve.
  useCierreModal({ ocupado: isConfirming, onCerrar: onClose });

  if (isConfirming) {
    return <Loading />;
  }

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await onConfirm();
    } catch (error) {
      console.error("Error confirming action:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  /**
   * Formatea el valor según su tipo
   */
  const formatValue = (value: string | number | Date): string => {
    if (value instanceof Date) {
      return DatetimeUtil.formatDate(value);
    }
    return String(value);
  };

  return (
    <div className="modal-box max-w-3xl w-11/12 relative p-0">
      <div className="w-full max-h-[90vh] overflow-y-auto">
        {/* Encabezado del modal */}
        <div className="app-modules-modal-header flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="app-modules-modal-kicker">{headerKicker}</p>
              <h2 className="app-modules-modal-title">{headerTitle}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-close shrink-0"
              aria-label="Cerrar modal"
              disabled={isConfirming}
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenido de confirmación */}
        <div className="app-modules-modal-body app-modules-modal-body-review">
          <div className="app-modules-modal-content app-modules-modal-content-review">
            <div className="app-modules-review-card">
              {/* Estado visual */}
              <div className="app-modules-review-status">
                <span
                  aria-hidden="true"
                  className="app-modules-review-status-icon"
                >
                  ✓
                </span>
                <span className="app-modules-review-status-copy">
                  {statusCopy}
                </span>
              </div>

              {/* Descripción */}
              <p className="app-modules-review-copy">{descriptionCopy}</p>

              {/* Información del objeto */}
              <div className="app-modules-review-list">
                {Object.entries(informationData).map(([label, value]) => (
                  <div
                    key={label}
                    className="app-modules-review-row"
                  >
                    <span className="app-modules-review-row-label">
                      {label}
                    </span>
                    <span className="app-modules-review-row-value">
                      {formatValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          {/* Ranura del padre: contenido extra ANTES de las acciones (p. ej. la clave del
              certificado cuando el firmador está encendido). */}
          {children}

          <div className="app-modules-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="app-modules-modal-cancel btn"
              disabled={isConfirming}
            >
              {cancelButtonText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="app-modules-modal-submit btn"
              disabled={isConfirming || !!message || confirmDisabled} // Deshabilita si ya hay un mensaje (error/warning) para evitar múltiples clicks, o si al padre le falta un dato
            >
              {isConfirming ? confirmButtonLoadingText : confirmButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDetail;
