/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/infracciones (frontend)
 * Feature: La infracción manda — la celda «Infracciones» de las bandejas (Fase 03.23, Plan 17, D-16)
 * Archivo: CeldaInfracciones.tsx
 * Responsabilidad: Pintar, en una celda de bandeja, los códigos de las infracciones de un EPAS y los
 *   avisos que el SERVIDOR calculó sobre ellos: la lectura de CORE pendiente, el conflicto de códigos
 *   y el descuadre de la multa. La comparten «Mis expedientes» y la Bandeja de Entrada (Plan 12).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-16
 *
 * ── 🔴 ESTA CELDA NO DECIDE NADA. TRADUCE ─────────────────────────────────────────────────────
 * Lee el bloque `infracciones` (`ResumenInfracciones`) tal y como llega. No parte códigos, no deduce
 * materias, no compara importes ni decide si hay conflicto: todo eso lo hizo el backend con las
 * materias de Sorteo y la foto de CORE (doctrina `editable`/`puedeAnexar`). Repetir aquí una regla
 * del servidor es tener dos reglas que un día dirán cosas distintas del mismo expediente. Una prueba
 * lee el fuente de este archivo para afirmar que no parte códigos (T-03.23-16).
 *
 * ── 🔴 EL ORDEN DE LAS PREGUNTAS ──────────────────────────────────────────────────────────────
 * Primero `codigos.length`, después `descuadre`. Para el backend un EPAS SIN infracciones también
 * descuadra (una multa sin filas que la sumen), y por eso llega con `descuadre: true`. Decir
 * «Descuadre» ahí mandaría al decisor a buscar un error de importes que no existe: lo que hay que
 * decir es «Sin infracciones» —o «Pendiente de CORE», si la foto todavía no se leyó—.
 *
 * ── DE DÓNDE SALEN LOS TEXTOS Y LOS COLORES ───────────────────────────────────────────────────
 * El texto del estado de CORE sale de `ETIQUETA_ESTADO_CORE` (una sola redacción para bandeja y
 * ficha). Los badges son `BadgePriority` con sus ranuras `default`/`media`/`alta`, como en
 * `ObligacionesVivas`: no se inventa un segundo sistema de etiquetas.
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: solo comentarios. La materia ya no
 *   sale de un diccionario local sino de Sorteo)
 */
import type { FC } from "react";
import BadgePriority from "../common/BadgePriority";
import {
  ETIQUETA_ESTADO_CORE,
  type ResumenInfracciones,
} from "../../services/InfraccionesService";

type CeldaInfraccionesProps = {
  /**
   * El bloque de la fila tal como lo mandó el servidor. Ausente cuando la respuesta no lo trae: se
   * pinta como «Sin infracciones», porque no hay código que enseñar.
   */
  resumen?: ResumenInfracciones;
};

/** Los textos de los avisos. El de CORE pendiente sale de la redacción única del estado. */
const TEXTO_CONFLICTO = "Conflicto de códigos";
const TEXTO_DESCUADRE = "Descuadre";
const TEXTO_SIN_INFRACCIONES = "Sin infracciones";

/**
 * La celda «Infracciones».
 *
 * Con códigos: el PRIMERO a la vista y «+N» por los demás, con la lista entera en el `title` y en un
 * texto solo para lector de pantalla —un «+2» suelto no le dice nada a quien no ve la tabla—.
 */
const CeldaInfracciones: FC<CeldaInfraccionesProps> = ({ resumen }) => {
  const codigos = resumen?.codigos ?? [];
  const pendiente = resumen?.estadoCore === "PENDIENTE";

  // SIN CÓDIGOS: ni descuadre ni conflicto tienen sentido (ver «EL ORDEN DE LAS PREGUNTAS»). Si
  // CORE no se ha leído todavía, eso es lo que se dice: puede que las infracciones aún no hayan
  // llegado, y «Sin infracciones» afirmaría algo que el servidor no sabe.
  if (codigos.length === 0) {
    return pendiente ? (
      <BadgePriority
        text={ETIQUETA_ESTADO_CORE.PENDIENTE}
        priority="default"
        size="sm"
        capitalize={false}
      />
    ) : (
      <span className="opacity-75">{TEXTO_SIN_INFRACCIONES}</span>
    );
  }

  const [primero, ...resto] = codigos;
  const listaCompleta = codigos.join(", ");
  const demo = resumen?.estadoCore === "DEMO";

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      title={`Infracciones: ${listaCompleta}`}
    >
      <span className="font-mono whitespace-nowrap">{primero}</span>
      {resto.length > 0 && (
        <>
          <span aria-hidden="true" className="opacity-75">
            +{resto.length}
          </span>
          <span className="sr-only">{`y además: ${resto.join(", ")}`}</span>
        </>
      )}

      {/* LA FOTO DE CORE SIN LEER. Informativo: no es un error del expediente, es que la lectura
          todavía no se ha hecho (o no se pudo hacer). */}
      {pendiente && (
        <BadgePriority
          text={ETIQUETA_ESTADO_CORE.PENDIENTE}
          priority="default"
          size="sm"
          capitalize={false}
        />
      )}

      {/* EL CONFLICTO. Urgente: Resolución y CORE no dicen los mismos códigos, y nada de lo que se
          deduzca de ellos —materia, aptitud para trabajo comunitario— es fiable hasta aclararlo. */}
      {resumen?.conflicto && (
        <BadgePriority
          text={TEXTO_CONFLICTO}
          priority="alta"
          size="sm"
          capitalize={false}
        />
      )}

      {/* EL DESCUADRE, solo aquí: con códigos a la vista, que la multa no cuadre SÍ es un aviso. */}
      {resumen?.descuadre && (
        <BadgePriority
          text={TEXTO_DESCUADRE}
          priority="media"
          size="sm"
          capitalize={false}
        />
      )}

      {/* LA FOTO SEMBRADA SIN RED. Discreta a propósito: cuenta como leída y no pide nada al
          decisor; solo deja constancia de que los datos no vienen de CORE de verdad. */}
      {demo && (
        <span
          className="text-xs italic opacity-60"
          title={ETIQUETA_ESTADO_CORE.DEMO}
        >
          demo
        </span>
      )}
    </div>
  );
};

export default CeldaInfracciones;
