/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/ordenes-pago (frontend)
 * Feature: La confirmación de «Anular» pasa al cascarón del módulo (Fase 03.22, Plan 06 — gap 1 del
 *   UAT, que cierra el diferido D1 del contrato de UI).
 * Archivo: ModalAnularOrden.tsx
 * Responsabilidad: Pedir el motivo con el que se anula una orden de pago, diciendo ANTES la
 *   consecuencia, y mandar `PATCH /ordenes-pago/:ordpId/anular`.
 *
 *   ── 🔴 ESTO NO ES LA REPARACIÓN DE UN DEFECTO ────────────────────────────────────────────────
 *   Hasta hoy el motivo se pedía con el diálogo del navegador. NO lo introdujo esta fase: la
 *   pantalla que la 03.22 retiró en su Plan 04 tenía el mismo código, el Plan 02 lo portó LITERAL
 *   **por contrato** (UI-SPEC §2.4 congela el porte y declara la deuda con sus cuatro
 *   consecuencias), y el propio contrato ya lo llevaba escrito como diferido **D1**. El usuario
 *   decide en el UAT cerrarlo ahora. Quien lea esto dentro de seis meses no debe concluir que
 *   alguien metió un defecto y lo tapó.
 *
 *   ── 🔴 EL MÍNIMO SE ENUNCIA Y NO SE COMPRUEBA AQUÍ (CH-5, doctrina de D-04) ───────────────────
 *   El texto DICE que el motivo lleva un mínimo de caracteres; quien lo IMPONE es el servidor, y es
 *   el único que lo impone. Está prohibido en este archivo: un atributo de longitud mínima en el
 *   campo, comparar la longitud contra el número, o derivar de ella el bloqueo del botón de
 *   confirmar. La razón está escrita desde el Plan 02 y no ha cambiado: *una segunda regla en el
 *   navegador es una regla que puede divergir de la única que manda*. Si el servidor bajara mañana
 *   el mínimo, un cliente que lo comprobara seguiría rechazando motivos válidos y nadie sabría por
 *   qué. Consecuencia ACEPTADA y dicha en voz alta: un motivo vacío también viaja y vuelve
 *   rechazado — es exactamente lo que pasaba con el cascarón nativo, que devolvía la cadena vacía y
 *   la celda la mandaba. Conservarlo es conservar la conducta, no un descuido.
 *
 *   ⚠️ **Y por eso, contra lo que hace `ModalDeshacerHacer`.** Ese modal SÍ comprueba su
 *   `@MinLength(10)` en el formulario, «para que el decisor lo lea junto al campo y no después de un
 *   viaje de ida y vuelta». Es una decisión legítima ALLÍ y está PROHIBIDA AQUÍ. Quien lea los dos
 *   modales seguidos va a querer igualarlos: no lo haga sin leer CH-5 en `03.22-CONTEXT.md`.
 *
 *   ── DÓNDE SE LEE EL RECHAZO ──────────────────────────────────────────────────────────────────
 *   Dentro de este modal, como alerta en línea, con el modal ABIERTO y lo escrito intacto. Antes
 *   salía por toast. Es el contrato documentado de `ConfirmationDetail` y es lo que el caso
 *   necesita: quien recibe «el motivo debe tener al menos 10 caracteres» tiene que poder corregirlo
 *   ahí mismo, y un toast por detrás del fondo oscurecido lo diría en el peor sitio posible. El
 *   ÉXITO sí sigue saliendo por toast: para entonces el modal ya se cerró y es la única superficie
 *   que queda.
 *
 *   ⚠️ El `AGENTS.md` de este repositorio es una copia sin rebrandear del frontend de Resolución y
 *   nombra otro microservicio y otro desarrollador. Manda el repo.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-24
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useState } from "react";
import { useCierreModal } from "../../hooks/useCierreModal";
import { type AlertVariant } from "../common/Alert";
import ConfirmationDetail from "../modals/ConfirmationDetail";
import { useToast } from "../../hooks/useToast";
import {
  OrdenPagoService,
  type TipoOrdenPago,
} from "../../services/OrdenPagoService";

/** Cómo se nombra el tipo dentro de una frase. El `id` de la columna no se lee en voz alta. */
const TIPO_EN_PALABRAS: Record<TipoOrdenPago, string> = {
  MULTA: "multa",
  REMANENTE: "remanente",
};

/**
 * 🔴 LITERAL DEL CONTRATO (UI-SPEC §5.2), palabra por palabra. Se dice ANTES de pedir el motivo
 * —regla del 03.19 §5.9—, y `ConfirmationDetail` ya lo da resuelto: la descripción se pinta dentro
 * de la ficha de datos y la ranura del padre va DESPUÉS, justo encima de las acciones.
 */
const CONSECUENCIA =
  "La orden no se borra: queda en el historial del expediente, porque puede haber salido ya en una providencia notificada.";

/**
 * La nota bajo el campo: es lo que ENUNCIA el mínimo, y dice de paso quién lo comprueba, para que
 * un rechazo no se lea como un fallo de la pantalla.
 */
const NOTA_DEL_MOTIVO =
  "Mínimo 10 caracteres. La comprobación la hace el servidor: si el motivo es corto, la anulación se rechaza y el motivo del rechazo aparece aquí mismo.";

/** El respaldo: sólo entra cuando lo capturado no es un `Error` con mensaje. */
const RESPALDO_ANULAR =
  "No se pudo anular la orden. Vuelva a intentarlo; si el problema continúa, comuníquelo al administrador del sistema.";

type ModalAnularOrdenProps = {
  ordpId: number;
  numero: string;
  tipo: TipoOrdenPago;
  /** El expediente tal y como la celda ya lo nombra (`expNumber ?? eejeId`). */
  expediente: string;
  onClose: () => void;
  /** La RECARGA de la bandeja del host: conserva filtros y página (no es un remontaje). */
  onAnulada: () => void | Promise<void>;
};

const ModalAnularOrden = ({
  ordpId,
  numero,
  tipo,
  expediente,
  onClose,
  onAnulada,
}: ModalAnularOrdenProps) => {
  const { addToast } = useToast();

  const [motivo, setMotivo] = useState("");
  // Cierre al pulsar fuera (quick 261019-mcf): el motivo escrito es trabajo sin guardar. El envío ya
  // lo declara `ConfirmationDetail`.
  useCierreModal({ hayCambios: motivo.trim() !== "" });
  const [alerta, setAlerta] = useState<{
    variant: AlertVariant;
    message: string;
  } | null>(null);

  /**
   * 🔴 NO RELANZA, y no es pereza: `ConfirmationDetail.handleConfirm` captura lo que suba desde
   * aquí y se lo traga con un `console.error`, así que un error propagado no llegaría a ninguna
   * parte. La alerta en línea es la única superficie que el usuario va a ver.
   *
   * El motivo viaja TAL CUAL, sin recortar a la fuerza ni rellenar: lo que quede en el historial
   * del expediente es lo que el decisor escribió (T-03.22-10).
   */
  const anular = async () => {
    setAlerta(null);
    try {
      await OrdenPagoService.anular(ordpId, motivo);
      addToast(
        "success",
        `Orden ${numero} anulada — queda registrada en la línea de tiempo del expediente.`,
      );
      await onAnulada();
      onClose();
    } catch (error) {
      // Solo el texto SEGURO del error (el del servidor o el genérico): nunca el de un error JS.
      const motivo = mensajeParaUsuario(error, "").replace(/\.+$/, "");
      setAlerta({
        variant: "error",
        message: motivo
          ? `No se pudo anular la orden: ${motivo}. Vuelva a intentarlo.`
          : RESPALDO_ANULAR,
      });
    }
  };

  return (
    <ConfirmationDetail
      headerKicker="Ejecución — DME · Órdenes de pago"
      headerTitle="Anular la orden de pago"
      statusCopy="Revise antes de anular"
      descriptionCopy={CONSECUENCIA}
      informationData={{
        Expediente: expediente,
        "N.º de orden": numero,
        Tipo: TIPO_EN_PALABRAS[tipo],
      }}
      message={alerta ?? undefined}
      cancelButtonText="Cancelar"
      confirmButtonText="Anular la orden"
      confirmButtonLoadingText="Anulando…"
      onConfirm={anular}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1">
        {/* El marcador NO es el nombre accesible (regla A6 del 03.19): la etiqueta envuelve al
            control, como en `ModalDeshacerHacer`.
            🔴 Y LA NOTA QUEDA FUERA DE LA ETIQUETA a propósito, al contrario que allí: el nombre
            accesible de un control envuelto por su `<label>` es TODO el texto de la etiqueta, así
            que meter la nota dentro haría que el lector de pantalla anunciara el párrafo entero
            cada vez que el foco entra en el campo (regla B4 del contrato: nombre accesible
            DISTINGUIBLE, no un recitado). Fuera de la etiqueta se sigue leyendo —está a
            continuación del campo— sin secuestrar su nombre. */}
        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Motivo de la anulación (obligatorio)
          </span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={motivo}
            placeholder="Por qué se anula esta orden"
            onChange={(e) => {
              setMotivo(e.target.value);
              // 🔴 LIMPIAR LA ALERTA AL TECLEAR NO ES COSMÉTICA. El cascarón compartido apaga su
              // botón de confirmar mientras haya mensaje —y no lo vuelve a encender solo—, así
              // que sin esta línea el primer rechazo del servidor dejaría el modal sin salida más
              // que Cancelar. Y como el mínimo lo impone el servidor, ese rechazo es el camino
              // ESPERADO, no el excepcional. La razón vive en `ConfirmationDetail`, no aquí.
              setAlerta(null);
            }}
          />
        </label>
        <span className="text-sm opacity-70">{NOTA_DEL_MOTIVO}</span>
      </div>
    </ConfirmationDetail>
  );
};

export default ModalAnularOrden;
