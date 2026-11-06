/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo del CUMPLIMIENTO (Fase 03.18, Plan 05)
 * Archivo: comunes.ts
 * Responsabilidad: Lo que los seis modales del tramo comparten y que sería peor repetir seis veces:
 *   la forma de la FILA que les llega por el contexto de modales, cómo se nombra el expediente y su
 *   administrado, la validación del PDF ANTES de subirlo y la lectura del mensaje de error.
 *
 *   ── 🔴 NINGÚN MODAL DE ESTA FASE LEE EL ESTADO DEL EPAS (criterio 7 de la fase) ──────────────
 *   Y por eso `FilaDeExpediente` **no declara el campo del estado**. No es un olvido: quien intente
 *   condicionar un botón por el estado del expediente no va a encontrar el dato, y ése es justo el
 *   punto. Si la acción procede o no lo decidió el motor de reglas (`POLITICA_ACCIONES`, Plan 04)
 *   ANTES de ofrecer el botón; un modal que lo vuelva a decidir por su cuenta solo puede divergir.
 *
 *   ── EL MODAL NO CALCULA PLAZOS ───────────────────────────────────────────────────────────────
 *   Aquí no hay ni una resta de fechas. Los días del término del art. 10 son HÁBILES y se cuentan
 *   contra el calendario de feriados del servidor; lo que se pinta es lo que el servidor derivó.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import type { ObligacionHacerEnBandeja } from "../../interfaces/IObligacionHacer";
import type { ExpedienteDocumento } from "../../services/EpasService";
import { DatetimeUtil } from "../../utils/datetime.util";

/**
 * El tope que el backend impone a los cuatro multipart de la rama
 * (`limits: { fileSize: 10 * 1024 * 1024 }` en `obligacion-hacer.controller.ts`).
 *
 * Se repite aquí a propósito y con la cita al lado: validar en el formulario NO sustituye al
 * servidor —el cliente siempre se puede saltar—, sirve para que el decisor se entere ANTES de pasar
 * cuarenta segundos subiendo por la red municipal un archivo que le van a rechazar.
 */
export const LIMITE_PDF_BYTES = 10 * 1024 * 1024;

/** El único tipo que el `fileFilter` del backend (`soloPdf`) deja pasar. */
export const TIPO_PDF = "application/pdf";

/**
 * La FILA tal y como llega por `openModal(tipo, data, callbacks)` → `ModalContainer` → `caseData`.
 *
 * Es deliberadamente PARCIAL: las cuatro bandejas mandan formas distintas (`EpasListItem` trae el
 * administrado partido en tres campos; `MiEpasAsignado` lo trae ya compuesto en `administrado`), y
 * el modal se tiene que apañar con las dos sin obligar a las páginas a normalizar antes.
 */
export interface FilaDeExpediente {
  /** `eeje_id` del EPAS. Es lo único imprescindible: sin él no hay ruta a la que llamar. */
  eejeId?: number;
  expNumber?: string;
  /** `EpasListItem`: persona natural. */
  admiName?: string;
  admiLastname?: string;
  /** `EpasListItem`: razón social. Cuando existe, ES la identidad del administrado. */
  admiBusinessName?: string | null;
  /** `MiEpasAsignado`: el administrado ya compuesto por el backend. */
  administrado?: string;
  /**
   * El bloque del correctivo que la fila ya trae resuelto del servidor (Fase 03.16, D-04). Opcional
   * porque no todas las bandejas lo mandan; ningún modal DECIDE con él, solo lo PINTA.
   */
  obligacionHacer?: ObligacionHacerEnBandeja;
}

/**
 * Las props con que `ModalContainer` monta todo modal del registro. Son las tres que pasa, ni una
 * más: `caseData`, `onClose` y `refetchFn`.
 */
export interface PropsModalRama {
  caseData: FilaDeExpediente;
  onClose: () => void;
  refetchFn?: () => Promise<void> | undefined;
}

/** Cómo se nombra el expediente en la ficha de confirmación. Nunca queda vacío. */
export const describirExpediente = (fila: FilaDeExpediente): string =>
  fila.expNumber ?? (fila.eejeId != null ? `EPAS #${fila.eejeId}` : "—");

/**
 * Cómo se nombra al administrado. La razón social MANDA cuando existe: titular el acto con el
 * nombre y apellido de un representante no describe a la empresa sancionada.
 */
export const describirAdministrado = (fila: FilaDeExpediente): string => {
  const razonSocial = fila.admiBusinessName?.trim();
  if (razonSocial) return razonSocial;

  const compuesto = fila.administrado?.trim();
  if (compuesto) return compuesto;

  const natural = `${fila.admiName ?? ""} ${fila.admiLastname ?? ""}`.trim();
  return natural || "administrado/a sin nombre";
};

/**
 * Valida el archivo ANTES de enviarlo: que esté, que sea PDF y que quepa.
 *
 * @returns el mensaje a pintar en el formulario, o `null` si el archivo sirve.
 */
export const validarPdf = (
  archivo: File | null,
  queEs = "El documento",
): string | null => {
  if (!archivo) {
    return `${queEs} es obligatorio: adjunte el PDF.`;
  }
  if (archivo.type !== TIPO_PDF) {
    return `${queEs} tiene que ser un PDF. «${archivo.name}» no lo es, y el servidor lo rechazaría.`;
  }
  if (archivo.size > LIMITE_PDF_BYTES) {
    const mb = (archivo.size / (1024 * 1024)).toFixed(1);
    return `${queEs} pesa ${mb} MB y el máximo son 10 MB. Reduzca la resolución del escaneo antes de subirlo.`;
  }
  return null;
};

/**
 * El mensaje del error tal y como lo trae el servidor. Se prefiere SIEMPRE al texto propio: el del
 * backend es el que explica la razón real (no es su decisor, el documento no es de este expediente,
 * el motivo es demasiado corto) y sustituirlo por una frase genérica la escondería. Delega en
 * `mensajeParaUsuario`: el texto de un error JS (no del servidor) nunca se pinta.
 */
export const mensajeDeError = (error: unknown, porDefecto: string): string =>
  mensajeParaUsuario(error, porDefecto);

/**
 * Cómo se lee un documento del expediente en el desplegable del selector: nombre, TIPO y fecha.
 *
 * ⚠️ El TIPO, no el subtipo: `GET /epas/:eejeId/documentos` no proyecta el subtipo documental. La
 * medición y su consecuencia están en la cabecera de `SelectorDocumentoExpediente.tsx`.
 *
 * Vive aquí y no junto al selector porque NO es un componente: sacarla del módulo del componente es
 * lo que exige `react-refresh/only-export-components`, y la regla tiene razón — un archivo que
 * exporta componentes y constantes a la vez pierde el recargado en caliente.
 */
export const describirDocumento = (doc: ExpedienteDocumento): string => {
  const partes = [doc.docName];
  if (doc.tdocTypeName) partes.push(doc.tdocTypeName);
  if (doc.docUploadedAt) partes.push(DatetimeUtil.formatDate(doc.docUploadedAt));
  return partes.join(" · ");
};
