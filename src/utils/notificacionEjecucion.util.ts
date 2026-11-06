/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: El Gestor de Notificaciones (Fase 03.20, D-16)
 * Archivo: notificacionEjecucion.util.ts
 * Responsabilidad: Las tres decisiones de la fila expandida del Gestor que NO son de pintado y que
 *   por tanto se pueden afirmar con una prueba: qué cuenta como despacho resuelto, en qué orden van
 *   las tres formas y cómo se llama cada una en la tarjeta.
 *
 *   ⚠️ NO se redeclaran aquí `EstadoDespacho` ni `FormaNotificacion`: ya existen en
 *   `NotificacionEjecucionService` y dos copias del mismo tipo acaban divergiendo. Lo que se
 *   importa es sólo el TIPO (`import type`), que se borra al compilar: este módulo sigue siendo
 *   puro y no arrastra el cliente HTTP a nadie que lo use.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-25
 */
import type { FormaNotificacion } from "../services/NotificacionEjecucionService";

/**
 * Los dos estados en los que un despacho está RESUELTO. Que `rechazado` esté aquí es D-16, y el
 * porqué está entero en el JSDoc de `porcentajeDespachosResueltos`.
 */
export const ESTADOS_DESPACHO_RESUELTOS = ["notificado", "rechazado"] as const;

/**
 * Lo mínimo que esta función necesita de un despacho: su estado, y como cadena LIBRE.
 *
 * No se pide el `Despacho` entero porque no se usa nada más de él, y no se pide la unión estrecha
 * `EstadoDespacho` porque el estado llega del servidor y puede venir en otra caja —o ser un valor
 * que este frontend todavía no conoce—. Tipar aquí la unión estrecha prometería una garantía que
 * el borde de la red no puede dar. `Despacho` encaja en esta forma sin conversión.
 */
type DespachoConEstado = { estado: string };

/**
 * Porcentaje de despachos RESUELTOS sobre el total, redondeado. Es el único cálculo del anillo de
 * la columna PROGRESO; el anillo en sí ya existe (`RadialProgress`) y no se toca.
 *
 * 🔴 DIVERGE DE RESOLUCIÓN, Y A PROPÓSITO. `getDespachosCompletionPercentage` de Resolución cuenta
 * **sólo** `notificado`. Ejecución tiene un tercer estado, `rechazado`, que es un despacho
 * **resuelto**: la vía se agotó, su razón de imposibilidad está emitida y **los plazos arrancan
 * igual**. Con la fórmula literal, un expediente con sus tres vías agotadas saldría **0 % en
 * rojo** — exactamente lo contrario de lo ocurrido (D-16). Hay que escribirlo con estas palabras,
 * porque «copia funcionamiento» diría lo contrario.
 *
 * ⚠️ EL CERO ES DEL CONSUMIDOR, NO DE AQUÍ. Devuelve `0` con la lista vacía **por compatibilidad
 * aritmética**, pero el consumidor **no debe pintar anillo** en ese caso: un anillo de 0 % en rojo
 * dice «nadie ha hecho nada, actúe» y es falso — no hay ningún canal que despachar. Medido el
 * 2026-09-25: **156 de 157** administrados no tienen ninguna forma aceptada, así que ése es el caso
 * NORMAL. El contrato está en §1.4 del contrato de UI y lo implementa la celda del Plan 07.
 *
 * @param despachos los despachos de UNA notificación.
 * @returns un entero de 0 a 100.
 */
export function porcentajeDespachosResueltos(
  despachos: readonly DespachoConEstado[],
): number {
  if (despachos.length === 0) {
    return 0;
  }

  const resueltos = despachos.filter((despacho) =>
    (ESTADOS_DESPACHO_RESUELTOS as readonly string[]).includes(
      String(despacho.estado ?? "").toLowerCase(),
    ),
  ).length;

  return Math.round((resueltos / despachos.length) * 100);
}

/**
 * El orden de las TRES tarjetas de la fila expandida. Es FIJO y viene de la captura: no se deriva
 * de los datos, porque la rejilla pinta siempre las tres —también las que el administrado no ha
 * aceptado, que salen con su hueco explicado— y un orden que cambiara con los datos movería las
 * tarjetas de sitio entre expedientes.
 */
export const ORDEN_FORMAS_NOTIFICACION = [
  "CASILLERO",
  "FISICO",
  "CORREO",
] as const satisfies readonly FormaNotificacion[];

/**
 * Cómo se llama cada forma en el TÍTULO DE LA TARJETA de la fila expandida.
 *
 * ⚠️ NO sustituye a `ETIQUETA_FORMA` de `NotificacionEjecucionService`, y las dos conviven a
 * propósito. Aquélla dice «Correo electrónico», «Casillero judicial» y «Físico (domicilio)», y la
 * usa la pantalla de FORMAS ACEPTADAS, donde los rótulos van en prosa dentro de una frase. Éstos
 * son los de la captura del Gestor: mayúsculas de título, porque son títulos de tarjeta, y
 * «Dirección Física» en vez de «Físico (domicilio)» porque la tarjeta ya enseña la dirección
 * debajo. Unificarlas cambiaría de paso una pantalla ajena a esta fase.
 */
export const ETIQUETA_FORMA_TARJETA: Record<FormaNotificacion, string> = {
  CASILLERO: "Casillero Judicial",
  FISICO: "Dirección Física",
  CORREO: "Correo Electrónico",
};
