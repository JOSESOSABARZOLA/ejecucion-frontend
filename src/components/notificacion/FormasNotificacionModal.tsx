/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La notificación al administrado (Fase 03.14.3)
 * Archivo: FormasNotificacionModal.tsx
 * Responsabilidad: Ser la CÁSCARA de diálogo del cuerpo de formas: encabezado, aspa, pie con
 *   «Cancelar» y «Guardar», y el aviso de éxito.
 *
 *   ── POR QUÉ ESTA PANTALLA ES IMPRESCINDIBLE ──────────────────────────────────────────────────
 *   Las formas aceptadas nacen todas en «no». Mientras nadie las declare, cada providencia que se
 *   emite crea su notificación **sin despachos**: el acto existe, nadie queda notificado y **ningún
 *   plazo arranca**. Esta pantalla es lo que cierra ese hueco.
 *
 *   ── LO QUE CAMBIÓ Y LO QUE NO ────────────────────────────────────────────────────────────────
 *   🔴 **La firma pública no cambia.** Sigue siendo `{ caso, onClose, onGuardado? }`, con el mismo
 *   `ExpedienteANotificar` estructural. La Bandeja de Recepción del SECRETARIO y la bandeja del
 *   DECISOR lo montan igual que antes y no se tocó ni una línea suya. Quitarle al secretario la
 *   única pantalla donde se declaran las formas dejaría al módulo sin despachos y ningún plazo
 *   arrancaría en ningún expediente, en silencio.
 *
 *   Lo que cambió es de dónde sale el contenido: vive en `FormasNotificacionCuerpo`, que el paso 3
 *   de la página de generación monta también. Aquí se le pasa `renderPie`, que es lo que le dice
 *   que GUARDE por sí mismo; el paso 3 no lo pasa y por eso solo levanta la selección.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-20
 * Modificado por: Andrés Miño — 2026-09-21 (el cuerpo se extrae para el paso 3 de la página de
 *   generación, D-05; la firma del modal no cambia)
 */

import { useState } from "react";
import DialogoModal from "../common/DialogoModal";
import { useToast } from "../../hooks/useToast";
import Boton from "../common/Boton";
import FormasNotificacionCuerpo from "./FormasNotificacionCuerpo";
import { type FormasAceptadas } from "../../services/NotificacionEjecucionService";
/**
 * Lo MÍNIMO que esta pantalla necesita de un expediente.
 *
 * Antes pedía un `MiEpasAsignado` entero —la fila de la bandeja del DECISOR—, y eso ataba la
 * pantalla a esa única bandeja aunque solo leyera tres campos de él. Desde el 2026-08-31 el
 * SECRETARIO también la abre, desde la Bandeja de Recepción, donde la fila es un `EpasListItem`:
 * otro tipo, con el nombre del administrado en otras columnas.
 *
 * `MiEpasAsignado` satisface esta forma estructuralmente, así que la bandeja del decisor sigue
 * pasando su fila tal cual y no se tocó ni una línea suya.
 */
export interface ExpedienteANotificar {
  eejeId?: number;
  expNumber?: string;
  /** Solo para el encabezado. Si no viene, manda el nombre que devuelve el backend con las formas. */
  administrado?: string;
}

interface Props {
  caso: ExpedienteANotificar;
  onClose: () => void;
  onGuardado?: () => void;
}

const FormasNotificacionModal = ({ caso, onClose, onGuardado }: Props) => {
  const { addToast } = useToast();
  /** Solo para el encabezado: el nombre que devuelve el backend junto con las formas. */
  const [nombre, setNombre] = useState<string | null>(null);
  /** Espejo del «hay escritura en vuelo» del cuerpo, para apagar el aspa del diálogo. */
  const [ocupado, setOcupado] = useState(false);

  const onDatos = (datos: FormasAceptadas) => setNombre(datos.nombre);
  const onEstado = ({ guardando }: { guardando: boolean }) =>
    setOcupado(guardando);

  return (
    <DialogoModal
      className="modal modal-open"
      onCerrar={onClose}
      ocupado={ocupado}
    >
      <div className="modal-box max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">Formas de notificación</h3>
            <p className="text-sm opacity-70">
              {nombre ?? caso.administrado ?? "administrado/a"} ·{" "}
              {caso.expNumber ?? `EPAS ${caso.eejeId ?? ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-modules-modal-close shrink-0"
            aria-label="Cerrar modal"
            disabled={ocupado}
          >
            ×
          </button>
        </div>

        <FormasNotificacionCuerpo
          eejeId={caso.eejeId}
          onDatos={onDatos}
          // El aspa del diálogo se apaga con la misma bandera que el pie: es el cuerpo quien sabe
          // si hay una escritura en vuelo, y cerrar a media escritura dejaría al usuario sin saber
          // si se guardó.
          onEstado={onEstado}
          renderPie={({ guardar, guardando, cargando, leido }) => {
            return (
              <div className="modal-action">
                <Boton
                  estilos="btn btn-ghost"
                  texto="Cancelar"
                  deshabilitado={guardando}
                  onClick={onClose}
                />
                {/* 🔴 `leido` no es un adorno de `cargando`. Con la lectura FALLIDA, `cargando` ya
                    es `false` y las tres casillas siguen en su `false` inicial: guardar así
                    reemplazaría las formas que el secretario declaró por «ninguna», y el expediente
                    dejaría de despachar notificaciones sin que nadie lo hubiera pedido. El cuerpo
                    además se niega por dentro; esto solo evita ofrecer un botón que no va a hacer
                    lo que promete. */}
                <Boton
                  estilos="btn btn-primary"
                  texto={guardando ? "Guardando…" : "Guardar"}
                  deshabilitado={guardando || cargando || !leido}
                  onClick={() => {
                    void guardar().then((ok) => {
                      // Solo se cierra con éxito. Con error el cuerpo ya pintó el motivo del
                      // servidor —que dice QUÉ dato falta para el canal marcado— y el diálogo
                      // permanece abierto para corregirlo.
                      if (!ok) return;
                      addToast("success", "Formas de notificación guardadas.");
                      onGuardado?.();
                      onClose();
                    });
                  }}
                />
              </div>
            );
          }}
        />
      </div>
    </DialogoModal>
  );
};

export default FormasNotificacionModal;
