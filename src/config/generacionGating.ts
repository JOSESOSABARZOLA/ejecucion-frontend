/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/generacion-documento (frontend)
 * Feature: La puerta de pasos de la página de generación (quick 261006-dw9; salida 3 → 4 del quick
 *   261026-ft2)
 * Archivo: generacionGating.ts
 * Responsabilidad: Qué cierra la salida de cada paso de la página de generación, y con qué frase.
 *   Vivía dentro de `GenerarDocumentoPage`; se saca aquí, pura, para poder afirmarla con una prueba
 *   sin montar la página. La página sigue siendo quien decide qué paso se ve y hasta dónde se llega:
 *   esto solo responde «qué falta».
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 */
import type { PasoGeneracion } from "../components/providencia/GeneracionStepper";

/** Lo que el compositor (y el paso 3) publican y decide si se puede salir de cada paso. Solo primitivos. */
export interface CondicionesAvance {
  tipoElegido: boolean;
  cuerpoConContenido: boolean;
  /** Qué hay que adjuntar, ya redactado por el compositor; `undefined` = no falta prueba. */
  motivoPrueba?: string;
  /**
   * Lo que falta en un canal MARCADO del paso 3, ya redactado con la frase del servidor (D-15).
   * `undefined` = ningún canal incompleto, incluida la selección vacía (D-12).
   */
  motivoFormas?: string;
}

/** Lo que falta para pasar del paso indicado al siguiente. `undefined` = se puede avanzar. */
export const motivoParaAvanzar = (
  paso: PasoGeneracion,
  condiciones: CondicionesAvance,
): string | undefined => {
  // 1 → 2 exige el tipo Y LA PRUEBA QUE ESE TIPO EXIGE (quick 261006-dw9, UAT 03.15 paso 8).
  //
  // Los `CAMPOS_CABECERA` NO entran: el compositor imprime lo que se llene y omite la línea entera
  // de lo que se deje vacío, así que ninguno es obligatorio y exigirlos aquí sería inventarse una
  // regla que el documento no tiene. La prueba SÍ entra, y por la razón contraria: la exige el acto,
  // el servidor rechaza la emisión sin ella, y se pide en ESTE paso — dejar salir sin ella era
  // dejar componer la providencia entera para descubrirlo al final.
  //
  // ⚠️ La declaración de aptitud, la decisión de prórroga y el destino de la devolución por nulidad
  // también viven en el paso 1 y NO cierran esta puerta: el encargo pidió la prueba. Las tres se
  // leen al final, junto a «Generar documento», con el paso donde se arreglan.
  if (paso === 1) {
    if (!condiciones.tipoElegido)
      return "Elija el tipo de providencia para continuar.";
    return condiciones.motivoPrueba;
  }
  // 2 → 3 exige TEXTO REAL. Lo decide el compositor (`cuerpoConContenido`), que deriva la respuesta
  // de las secciones que se enviarían: un `<p></p>` huérfano no cuenta.
  if (paso === 2) {
    return condiciones.cuerpoConContenido
      ? undefined
      : "Escriba el cuerpo de la providencia para continuar.";
  }
  // 3 → 4, con sus dos mitades (quick 261026-ft2):
  //  · SIN NINGUNA FORMA sigue LIBRE (D-12): el paso 3 avisa de lo que eso cuesta, y bloquear la
  //    selección vacía sería inventarse una regla que el servidor no tiene.
  //  · UN CANAL MARCADO SIN SU DATO cierra la salida, porque esa regla el servidor SÍ la tiene
  //    (D-15, `guardarFormas`): dejarlo pasar era descubrirlo al confirmar la emisión, cuando
  //    `guardarFormasAntesDeEmitir` persiste la selección (bug del 2026-10-26).
  if (paso === 3) return condiciones.motivoFormas;
  return undefined;
};

/**
 * Lo que falta para LLEGAR al paso indicado, desde el principio: el primer motivo de las salidas
 * 1 … destino-1 (quick 261006-dw9). Acumulado y no solo el del paso anterior, para que el paso 3 o
 * el 4 no digan «Escriba el cuerpo» cuando lo que falta de verdad es el comprobante del paso 1.
 */
export const motivoParaLlegarA = (
  destino: PasoGeneracion,
  condiciones: CondicionesAvance,
): string | undefined => {
  for (let p = 1; p < destino; p++) {
    const motivo = motivoParaAvanzar(p as PasoGeneracion, condiciones);
    if (motivo) return motivo;
  }
  return undefined;
};

/** El primer paso cuya salida está cerrada; 4 si ninguna lo está. Es el techo de lo alcanzable. */
export const topeDeLasPuertas = (
  condiciones: CondicionesAvance,
): PasoGeneracion => {
  for (let p = 1; p < 4; p++) {
    if (motivoParaAvanzar(p as PasoGeneracion, condiciones))
      return p as PasoGeneracion;
  }
  return 4;
};
