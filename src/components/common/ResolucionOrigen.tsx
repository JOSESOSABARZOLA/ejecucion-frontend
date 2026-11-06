/**
 * Microservicio: ejecucion
 * Módulo: común
 * Feature: La resolución con la que llega el expediente (2026-09-08)
 * Archivo: ResolucionOrigen.tsx
 * Responsabilidad: Pintar, en una línea, LA MULTA IMPUESTA y LA RESOLUCIÓN con la que el expediente
 *   llega desde la DMR. Vive aquí y no en cada bandeja porque lo pide el área usuaria en las CUATRO
 *   (Entrada, Expedientes, Mis expedientes y Sorteo) y cuatro copias del mismo formato divergen: el
 *   día que la multa se muestre con dos decimales en una y con cero en otra, nadie sabrá cuál manda.
 *
 *   ── LO QUE FALTA NO SE PINTA ─────────────────────────────────────────────────────────────────
 *   Un campo sin valor NO se imprime: se omite la línea entera, mismo criterio que la cabecera de
 *   las providencias adoptó el 2026-09-08. Aquí importa más que allí, porque hoy los dos campos
 *   están vacíos en casi todo: Resolución todavía no los emite y ningún expediente aterrizado antes
 *   del 08-09 los tiene. Pintar «Multa: USD 0,00» sobre un expediente cuya multa no se declaró sería
 *   afirmar que la multa fue cero.
 *
 *   Si no hay NINGUNO de los dos, el componente no renderiza nada — ni un contenedor vacío, que en
 *   una fila con `gap` deja un hueco fantasma.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-08
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — sale el formateador propio con «$»:
 *   la multa se pinta con `formatearUsd` de `utils/importe.util`, «USD 2.300,00», el único del
 *   frontend)
 */
import { DatetimeUtil } from "../../utils/datetime.util";
import { formatearUsd } from "../../utils/importe.util";

interface Props {
  /** Multa impuesta, en dólares. */
  multa?: number | null;
  /** Número de la resolución sancionadora de origen. */
  numero?: string | null;
  /** Fecha de esa resolución (ISO). Solo acompaña al número; nunca se muestra sola. */
  fecha?: string | null;
  /** Clase de cada `<span>`, para que la línea herede el estilo de la bandeja que la aloja. */
  className?: string;
}

export const ResolucionOrigen = ({
  multa,
  numero,
  fecha,
  className = "app-inbox-document-date",
}: Props) => {
  const hayMulta = typeof multa === "number" && Number.isFinite(multa);
  const hayNumero = Boolean(numero?.trim());

  if (!hayMulta && !hayNumero) return null;

  return (
    <>
      {hayMulta && (
        <span className={className} title="Multa impuesta por la resolución">
          Multa: {formatearUsd(multa as number)}
        </span>
      )}
      {hayNumero && (
        <span
          className={className}
          // La fecha va en el tooltip y no en la línea: el número es lo que identifica el acto y lo
          // que se busca; la fecha ocupa tanto como él y se consulta mucho menos.
          title={
            fecha
              ? `Resolución de ${DatetimeUtil.formatDate(fecha)}`
              : "Resolución sancionadora de origen"
          }
        >
          Res. {numero}
        </span>
      )}
    </>
  );
};

export default ResolucionOrigen;
