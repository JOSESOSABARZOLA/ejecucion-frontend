/**
 * Microservicio: ejecucion
 * Módulo: Firma digital (frontend) — Fase 03.21
 * Feature: Contrato de copy de la firma digital real y helpers del error APP-FIRMA
 * Archivo: firmaCopy.ts
 * Responsabilidad: El contrato de copy de la firma digital real (UI-SPEC 03.21 §10) y la única forma
 *   de reconocer y componer un fallo de firma; ningún texto interpola la clave, el token, el mensaje
 *   crudo de auth-amc ni una ruta.
 *
 *   ── POR QUÉ UN SOLO CATÁLOGO ─────────────────────────────────────────────────────────────────
 *   La clave se pide en cinco superficies (paso 4 de la generación, excusa, despacho DMR/DMIT, firma
 *   del acta y combo). Si cada una escribiera su copy, el mismo dato acabaría con dos rótulos y el
 *   usuario creería que son dos claves distintas. Aquí vive el texto; las superficies lo consumen.
 *
 *   ── CÓMO SE COMPONE UN FALLO ─────────────────────────────────────────────────────────────────
 *   El servidor (`MENSAJES_FIRMA` del backend) dice LA CAUSA y QUÉ HACER; no dice qué quedó sin
 *   hacer, porque eso depende de la superficie. Cada superficie antepone su consecuencia
 *   (`CONSECUENCIA_FALLO_FIRMA`) y el resultado es «{consecuencia} {texto del servidor}». El texto
 *   del servidor se obtiene SIEMPRE por `mensajeParaUsuario`, que nunca pinta el detalle técnico.
 *
 *   La clave incorrecta (`APP-FIRMA-CLAVE-001`) es la ÚNICA causa que activa el estado E del campo
 *   (vaciarlo, marcarlo y devolverle el foco); `esClaveIncorrecta` es su única puerta.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 10: `exitoProvidencia`, los avisos de
 *   éxito de la providencia según si la firma se aplicó, UI-SPEC §10.7).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 14: `exitoExcusa`, el aviso de éxito de
 *   la excusa según si el escrito salió firmado, UI-SPEC §10.7).
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 15: `exitoFirmaActa`, los avisos de
 *   éxito del acta D2 por rol y según si la firma se aplicó (§10.7), y `AVISO_ACTA_SIN_VISTA_PREVIA`,
 *   el aviso de §10.8 con el firmador encendido.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-01: `AVISO_MODO_FIRMA_CARGANDO` y
 *   `AVISO_MODO_FIRMA_DESCONOCIDO`, los estados del campo mientras el modo no se conoce.)
 * Modificado por: Andrés Miño — 2026-10-27 (revisión 03.21, WR-03: `AVISO_LISTA_NO_ACTUALIZADA`, el
 *   aviso de una lista que no se refrescó tras un acto que sí se completó.)
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 */

import { esHttpClientError, mensajeParaUsuario } from "../api/mensajeParaUsuario";

/**
 * Las siete causas de un fallo de firma, espejo LITERAL de `CausaFirma` del backend
 * (`src/common/errors/firma-documento.error.ts`). El combo las devuelve por acta en su reporte.
 */
export type CausaFirma =
  | "FALTA_CLAVE"
  | "SIN_SESION_CENTRAL"
  | "CLAVE_INCORRECTA"
  | "CERTIFICADO"
  | "FIRMADOR_NO_RESPONDE"
  | "RESPUESTA_INVALIDA"
  | "DOCUMENTO_NO_FIRMABLE";

/** Prefijo de los códigos propios de la firma en el sobre de error (`error.code`). */
export const PREFIJO_CODIGO_FIRMA = "APP-FIRMA-";

/** Código de la clave incorrecta: el único que activa el estado E del campo. */
export const CODIGO_CLAVE_INCORRECTA = "APP-FIRMA-CLAVE-001";

/** Rótulo del campo de clave, el mismo en todas las superficies (UI-SPEC §2.1). */
export const ROTULO_CLAVE_FIRMA = "Clave de firma";

/** Pista bajo el campo (UI-SPEC §10.3). No dice «este documento»: en el combo una clave firma N actas. */
export const PISTA_CLAVE_FIRMA =
  "Se usa únicamente para firmar y no se guarda en ningún momento. Si la firma no se aplica, no se guarda nada.";

/** Línea de error bajo el campo tras un rechazo de la clave (UI-SPEC §10.2, estado E). */
export const ERROR_CLAVE_INCORRECTA = "La clave de firma no es correcta.";

/**
 * El aviso del firmador apagado, por superficie (UI-SPEC §10.4, D-11). `generacion` es idéntico a
 * `TEXTO_FIRMA_DESACTIVADA` de `PasoFirmaClave`: es el mismo aviso, ahora con un solo origen.
 */
export const AVISO_SIN_FIRMADOR = {
  generacion:
    "La firma digital está desactivada en este despliegue: el documento se generará SIN firma criptográfica.",
  excusa:
    "La firma digital está desactivada en este despliegue: el escrito de excusa se presentará SIN firma criptográfica.",
  memorando:
    "La firma digital está desactivada en este despliegue: el memorando de devolución se generará SIN firma criptográfica.",
  acta: "La firma digital está desactivada en este despliegue: su firma quedará registrada, pero el acta quedará SIN firma criptográfica.",
} as const;

/** Estado C del campo: firmador encendido y la sesión no viene del Auth central (UI-SPEC §10.5, D-12). */
export const AVISO_SIN_SESION_CENTRAL =
  "Para firmar hay que entrar al sistema con el Auth central, y su sesión actual no lo está. Cierre sesión y vuelva a entrar por el Auth central. Mientras tanto no se puede emitir nada que lleve firma.";

/**
 * Mientras se lee el modo de firma (`GET /sorteo/firma/modo`): todavía no se sabe si hay que pedir la
 * clave, así que no se pinta ni el campo ni el aviso del firmador apagado (revisión 03.21, WR-01).
 */
export const AVISO_MODO_FIRMA_CARGANDO =
  "Comprobando si la firma digital está activa en este despliegue…";

/**
 * No se pudo leer el modo de firma. No se afirma que la firma esté desactivada —sería falso si está
 * encendida— y no se deja firmar hasta saberlo (revisión 03.21, WR-01).
 */
export const AVISO_MODO_FIRMA_DESCONOCIDO =
  "No se pudo comprobar si la firma digital está activa en este despliegue, así que todavía no se puede firmar. Vuelva a intentarlo; si el aviso persiste, recargue la página.";

/** Motivo del botón apagado en el estado C (UI-SPEC §10.5). */
export const MOTIVO_SIN_SESION_CENTRAL =
  "Entre al sistema con el Auth central para poder firmar.";

/** Frase que se añade a la confirmación de la página con el firmador encendido (UI-SPEC §10.6). */
export const FRASE_CONFIRMACION_CON_FIRMA =
  "El documento se firmará con su certificado antes de guardarse; si la firma no se aplica, no se emite nada.";

/**
 * Lo que cada superficie antepone al texto del servidor cuando la firma falla (UI-SPEC §10.1).
 * Responde a la pregunta del usuario tras un fallo: «¿quedó algo hecho a medias?». En el director es
 * la más grave, porque la aprobación en Asignaciones es irreversible, y la frase dice que no ocurrió.
 */
export const CONSECUENCIA_FALLO_FIRMA = {
  generacion: "No se generó el documento.",
  excusa: "No se presentó la excusa.",
  actaDecisorSecretario: "El acta no se firmó.",
  actaDirector: "El acta no se firmó y el lote no se aprobó en Asignaciones.",
  despacho: "No se generó el lote ni su memorando.",
  combo: "No se firmó ninguna acta.",
} as const;

/**
 * El aviso de éxito de una providencia emitida (UI-SPEC §10.7, D-11): dice si salió FIRMADA, para
 * que nadie termine el trámite creyendo que firmó cuando el despliegue tiene el firmador apagado.
 *
 * @param aplicada `firma.aplicada` de la respuesta del servidor.
 * @param accion el desenlace sobre el EPAS ya en palabras (`ETIQUETA_ACCION_EPAS`), si lo hubo.
 */
export function exitoProvidencia(aplicada: boolean, accion?: string): string {
  if (accion) {
    return aplicada
      ? `Providencia emitida y firmada. Además, ${accion}.`
      : `Providencia emitida SIN firma criptográfica. Además, ${accion}.`;
  }
  return aplicada
    ? "Providencia emitida, firmada y adjuntada al expediente."
    : "Providencia emitida SIN firma criptográfica y adjuntada al expediente.";
}

/**
 * El aviso de éxito de la excusa (UI-SPEC §10.7, D-11/D-19): dice si el ESCRITO salió firmado. El
 * de antes («Solicitud de excusa enviada») no lo decía, y con el firmador apagado el decisor creería
 * haber presentado un escrito firmado.
 *
 * @param escritoFirmado `escritoFirmado` de la respuesta de `POST /sorteo/:cassId/excusa`.
 */
export function exitoExcusa(escritoFirmado: boolean): string {
  return escritoFirmado
    ? "Excusa presentada con el escrito firmado."
    : "Excusa presentada. El escrito quedó SIN firma criptográfica.";
}

/**
 * El aviso de éxito de la firma del acta D2 (UI-SPEC §10.7, D-10/D-11). Distingue al director porque
 * su firma es además la APROBACIÓN del lote en Asignaciones, y dice si la firma digital se aplicó:
 * con el firmador apagado el acta queda SIN firma criptográfica, y ya no se promete una firma
 * posterior que no va a ocurrir (C6).
 *
 * @param firmado `firmado` de la respuesta de `PATCH /sorteo/:amasId/:decisorUserId/firmar`.
 * @param esDirector si firma el director (orden 3).
 */
export function exitoFirmaActa(firmado: boolean, esDirector: boolean): string {
  if (esDirector) {
    return firmado
      ? "Acta firmada y lote aprobado en Asignaciones."
      : "Firma registrada y lote aprobado en Asignaciones. El acta quedó SIN firma criptográfica: la firma digital está desactivada en este despliegue.";
  }
  return firmado
    ? "Acta firmada: su firma digital quedó aplicada."
    : "Firma registrada. La firma digital está desactivada en este despliegue: el acta quedó SIN firma criptográfica.";
}

/**
 * El aviso de una vista previa del acta que no cargó, con el firmador ENCENDIDO (UI-SPEC §10.8). Ya
 * no se firma sin acta (`DOCUMENTO_NO_FIRMABLE`), así que no promete que «aún puede firmar»: avisa de
 * que la firma puede rechazarse, y de que entonces no se aplica nada.
 */
export const AVISO_ACTA_SIN_VISTA_PREVIA =
  "No se pudo cargar la vista previa del acta. Puede intentar firmar: si el acta todavía no existe, la firma se rechazará y no se aplicará nada.";

/**
 * La firma (o la excusa) YA se aplicó, pero la lista de detrás no se pudo refrescar (revisión 03.21,
 * WR-03). No es un fallo de firma: decirlo como tal empujaría a repetir un acto ya hecho —en el
 * director, una aprobación ya enviada a Asignaciones— y a teclear la clave otra vez para nada.
 */
export const AVISO_LISTA_NO_ACTUALIZADA =
  "Quedó hecho, pero no se pudo actualizar la lista. Actualícela antes de repetir nada.";

/** Frase genérica si el error no trae un texto que se pueda pintar. */
const FALLO_FIRMA_POR_DEFECTO = "No se pudo aplicar la firma.";

/**
 * ¿El error es un fallo de firma? Solo si es un `HttpClientError` cuyo `code` (el del sobre del
 * servidor) empieza por `APP-FIRMA-`. Un `Error` cualquiera con ese texto en su mensaje no cuenta.
 */
export function esErrorDeFirma(err: unknown): boolean {
  return (
    esHttpClientError(err) &&
    typeof err.code === "string" &&
    err.code.startsWith(PREFIJO_CODIGO_FIRMA)
  );
}

/** ¿La firma falló porque la clave no es correcta? Única puerta del estado E del campo. */
export function esClaveIncorrecta(err: unknown): boolean {
  return esHttpClientError(err) && err.code === CODIGO_CLAVE_INCORRECTA;
}

/**
 * El texto de un fallo de firma: «{consecuencia} {texto del servidor}» (UI-SPEC §10.1).
 *
 * 🔴 Solo concatena la consecuencia propia de la superficie y lo que devuelve `mensajeParaUsuario`:
 * nunca el detalle técnico del error, la clave, el token ni una ruta.
 *
 * @param consecuencia una entrada de `CONSECUENCIA_FALLO_FIRMA`.
 * @param err lo capturado en el `catch`.
 */
export function mensajeDeFalloDeFirma(consecuencia: string, err: unknown): string {
  return `${consecuencia} ${mensajeParaUsuario(err, FALLO_FIRMA_POR_DEFECTO)}`;
}
