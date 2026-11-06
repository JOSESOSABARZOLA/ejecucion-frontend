/**
 * Microservicio: ejecucion
 * Módulo: Alertas
 * Feature: Adónde lleva una alerta de la campana (quick 261030-m29, D-CANAL)
 * Archivo: destinoAlerta.ts
 * Responsabilidad: Validar que la ruta de una alerta es INTERNA antes de navegar a ella, y reunir
 *   el flujo «quitar del panel → marcar leída → navegar» que comparten la campana y Avisos.
 *
 *   Es la SEGUNDA LLAVE contra una ruta inyectada (T-m29-02): el backend ya descarta al emitir toda
 *   ruta que no sea `/home/…`, pero la ruta viaja de la base al navegador y decide adónde se va el
 *   usuario. Aunque alguien escribiera la columna a mano, la campana nunca sale de `/home/`: nada
 *   de esquemas (`https:`, `javascript:`), de `//host` ni de `..`.
 *
 *   El patrón es el MISMO que `RUTA_INTERNA_ALERTA` del backend
 *   (`src/modules/alert/interfaces/alert.interface.ts`), con el mismo tope de 300 caracteres de la
 *   columna `ares_ruta`. Si uno cambia, el otro también.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-30
 */
import type { IAlert } from "../interfaces/IAlert";

/** Ruta interna admitida: `/home/segmento(/segmento)*` y, opcionalmente, una query sin `:` ni `/`. */
export const RUTA_INTERNA_ALERTA =
  /^\/home\/[a-z0-9-]+(\/[a-z0-9-]+)*(\?[A-Za-z0-9._~%=&-]*)?$/;

/** Tope de la columna `ares_ruta` (igual que el backend). */
export const MAX_RUTA_ALERTA = 300;

/**
 * Adónde lleva una alerta, o `null` si no lleva a ningún sitio seguro.
 * @param alerta la alerta (solo se lee `aresRuta`).
 * @returns la ruta interna tal cual, o `null` si falta, es demasiado larga o no es `/home/…`.
 */
export function destinoDeAlerta(
  alerta: Pick<IAlert, "aresRuta">,
): string | null {
  const ruta = alerta.aresRuta;
  if (typeof ruta !== "string" || ruta.length === 0) return null;
  if (ruta.length > MAX_RUTA_ALERTA) return null;
  return RUTA_INTERNA_ALERTA.test(ruta) ? ruta : null;
}

/** Lo que el flujo de abrir una alerta necesita de quien lo llama. */
export interface AccionesAbrirAlerta {
  /** Refleja la lectura en la vista (quitarla del panel, marcar la fila como leída…). */
  marcarLeidaEnVista: (ualeId: number) => void;
  /** Registra la lectura en el servidor (`PUT /alert/:ualeId/read`). */
  marcarLeidaEnServidor: (ualeId: number) => Promise<unknown>;
  /** Navega a una ruta interna ya validada. */
  navegar: (ruta: string) => void;
}

/**
 * El flujo de pulsar una alerta: refleja la lectura en la vista, la registra en el servidor y, si
 * la alerta lleva a una ruta interna válida, navega a ella.
 *
 * Una marca de lectura que falla NO molesta al usuario ni bloquea el camino: se registra con
 * `console.warn`, la alerta se queda leída en la vista y se navega igual (el siguiente sondeo
 * devolverá la verdad del servidor). Una alerta ya leída no vuelve a pedir la marca.
 * @param alerta la alerta pulsada.
 * @param acciones cómo reflejar, registrar y navegar.
 */
export async function abrirAlerta(
  alerta: Pick<IAlert, "ualeId" | "ualeRead" | "aresRuta">,
  acciones: AccionesAbrirAlerta,
): Promise<void> {
  if (!alerta.ualeRead) {
    acciones.marcarLeidaEnVista(alerta.ualeId);
    try {
      await acciones.marcarLeidaEnServidor(alerta.ualeId);
    } catch (error) {
      console.warn(
        "[Alertas] No se pudo registrar la lectura de la alerta",
        alerta.ualeId,
        error,
      );
    }
  }

  const destino = destinoDeAlerta(alerta);
  if (destino) {
    acciones.navegar(destino);
  }
}
