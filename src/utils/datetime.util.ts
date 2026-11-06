/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/comun (frontend)
 * Feature: Los formatos de fecha del módulo
 * Archivo: datetime.util.ts
 * Responsabilidad: El único sitio donde este frontend decide cómo se escribe una fecha. Son
 *   CUATRO formatos y conviven a propósito: la antigüedad en lenguaje natural de las cabeceras, el
 *   `dd/MM/yyyy` denso de las columnas de tabla, la fecha en letra de los documentos —espejo del
 *   backend— y la corta de las tarjetas.
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 * Modificado por: Andrés Miño — 2026-09-25 (Fase 03.20, Plan 02, §2.5.2 del contrato de UI:
 *   `formatFechaCorta`, la fecha de la tarjeta de despacho del Gestor de Notificaciones. Y el
 *   fichero estrena cabecera: no tenía ninguna, y `CLAUDE.md` la exige en todo fichero que se
 *   toca.)
 * Modificado por: Andrés Miño — 2026-10-26 (Fase 03.21, Plan 11, UI-SPEC §8.1: un QUINTO formato,
 *   `formatFechaHoraCorta`, la fecha con hora de cada línea del sello «Firmado».)
 */
import { format, formatDistance, type Locale } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Las doce abreviaturas de mes de la CAPTURA, escritas aquí y no heredadas de nadie.
 *
 * 🔴 MEDIDO el 2026-09-25, y es la única divergencia de este plan respecto de lo que su propio
 * texto daba por hecho: `date-fns@4.1.0` con `locale: es` abrevia septiembre **`sep`**, mientras
 * que la captura —y el contrato de UI, §2.5.2 y §5.3— dicen **`sept`**. El analog de Resolución
 * escribe `sept` porque formatea con el conversor a texto local del objeto de internacionalización
 * del runtime, y ésa es la abreviatura estándar del español en CLDR. Las otras once coinciden byte
 * a byte con las de `date-fns`.
 *
 * Se resuelve poniendo la tabla aquí en vez de volviendo al formateador del sistema: éste sigue
 * siendo determinista —no depende de con qué se haya compilado el runtime, ni en producción ni en
 * jsdom, que es donde se afirma— y además da EXACTAMENTE el texto contratado. Las doce están
 * afirmadas una por una en la prueba, no sólo la de septiembre.
 */
const ABREVIATURAS_MES_DE_LA_CAPTURA = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
] as const;

/**
 * El locale español de `date-fns` con UNA sola cosa cambiada: la abreviatura de mes. Todo lo demás
 * —el mes entero, los días, los ordinales, el orden de las unidades— sigue viniendo de `es`, para
 * que `formatFechaLarga` y esta función no puedan separarse.
 */
const esConAbreviaturaDeLaCaptura: Locale = {
  ...es,
  localize: {
    ...es.localize,
    month: (indice, opciones) =>
      opciones?.width === "abbreviated"
        ? ABREVIATURAS_MES_DE_LA_CAPTURA[indice]
        : es.localize.month(indice, opciones),
  },
};

export class DatetimeUtil {
  // Tiempo transcurrido desde una fecha
  static getTimeAgo(date: Date): string {
    return formatDistance(date, new Date(), {
      addSuffix: true,
      locale: es,
      includeSeconds: true,
    });
  }

  static formatDate (date: Date | string | null | undefined): string {
    if (!date) {
      return "Sin fecha";
    }
    return format(new Date(date), "dd/MM/yyyy");
  }

  /**
   * ANTIGÜEDAD en lenguaje natural ("hace 6 días"), tolerante a string/null — la contraparte de
   * formatDate para las cabeceras de las bandejas.
   *
   * Una fecha cruda ("07/07/2026") obliga a quien la lee a restar mentalmente contra hoy para saber
   * lo único que le importa: cuánto lleva esperando el expediente. La antigüedad lo dice directo.
   * Devuelve null (no "Sin fecha") cuando no hay dato, para que el consumidor simplemente no pinte
   * nada en lugar de añadir ruido a la cabecera.
   */
  static formatTimeAgo(date: Date | string | null | undefined): string | null {
    if (!date) {
      return null;
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return DatetimeUtil.getTimeAgo(parsed);
  }

  /**
   * Fecha en LETRA para documentos: «16 de septiembre de 2026».
   *
   * 🔑 Es el ESPEJO EXACTO de `formatDocumentDateLong` del backend
   * (`documentation/utils/document-date.util.ts`), con el mismo patrón y el mismo locale. Si los dos
   * divergen, el escrito de excusa llevará una fecha con distinto formato que el resto de documentos
   * del mismo expediente — y nadie lo vería hasta tener los dos papeles delante.
   *
   * Una fecha inválida cae a HOY en vez de reventar, igual que hace el backend: esto alimenta el
   * token `{Fecha}` mientras el decisor redacta, y una excepción aquí dejaría el editor en blanco.
   *
   * @param date fecha a formatear; por defecto, hoy.
   */
  static formatFechaLarga(date?: Date | string): string {
    const parsed = date ? new Date(date) : new Date();
    const valida = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return format(valida, "d 'de' MMMM 'de' yyyy", { locale: es });
  }

  /**
   * Fecha CORTA para las tarjetas: «10 sept 2026» (§2.5.2 del contrato de UI de la Fase 03.20).
   *
   * Es la que va bajo los rótulos `Entrega:` y `Envío:` de la fila de despacho del Gestor de
   * Notificaciones.
   *
   * 🔴 NO se copia el conversor a texto local del analog de Resolución —el del objeto de
   * internacionalización del runtime—. Ese formateador depende del ICU con el que se haya
   * compilado el runtime: el mismo código puede dar una cadena distinta en producción y en la
   * máquina de quien la afirma, y jsdom —donde viven las pruebas— es justo uno de esos entornos.
   * `date-fns` lleva sus propias tablas y es determinista.
   *
   * ⚠️ Devuelve CADENA VACÍA cuando no hay fecha, no «Sin fecha»: la tarjeta simplemente no pinta
   * la línea meta, y una palabra ahí ocuparía el sitio de un dato que no existe. Es el mismo
   * criterio que `formatTimeAgo`, que devuelve nulo en vez de texto. `formatDate`, que sí dice
   * «Sin fecha», vive en una CELDA de tabla, donde dejar el hueco en blanco parecería un fallo de
   * carga.
   *
   * ⚠️ La columna FECHA CREACIÓN de la tabla SIGUE en `dd/MM/yyyy` (`formatDate`). Los dos
   * formatos conviven porque los dos están en la captura: la columna es densa y se escanea en
   * vertical, la tarjeta es prosa. No se unifican.
   *
   * @param date la fecha a formatear; ausente o inválida devuelve cadena vacía.
   */
  static formatFechaCorta(date: Date | string | null | undefined): string {
    if (!date) {
      return "";
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return format(parsed, "d MMM yyyy", {
      locale: esConAbreviaturaDeLaCaptura,
    });
  }

  /**
   * Fecha CORTA CON HORA para el sello «Firmado»: «26 oct 2026, 15:40» (Fase 03.21, UI-SPEC §8.1).
   *
   * Es la de cada línea del sello (`Decisor: Ana Pérez · 26 oct 2026, 15:40`). Lleva hora porque es
   * la constancia de un acto jurídico: dos firmas del mismo día sobre el mismo acta tienen que poder
   * distinguirse, y el orden en que se aplicaron es parte de lo que el sello dice.
   *
   * 🔴 Usa la MISMA tabla de abreviaturas que `formatFechaCorta` (`sept`, no `sep`): el sello y la
   * tarjeta del Gestor no pueden escribir el mismo mes de dos maneras. Y, por la misma razón que
   * ella, formatea con `date-fns` y no con el conversor a texto local del runtime (03.20 §2.5.2):
   * la hora en 24 h con dos cifras sale igual en producción y en jsdom.
   *
   * ⚠️ Sin fecha, o con una inválida, devuelve CADENA VACÍA, igual que `formatFechaCorta`.
   *
   * @param date la fecha a formatear; ausente o inválida devuelve cadena vacía.
   */
  static formatFechaHoraCorta(date: Date | string | null | undefined): string {
    if (!date) {
      return "";
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return format(parsed, "d MMM yyyy, HH:mm", {
      locale: esConAbreviaturaDeLaCaptura,
    });
  }
}
