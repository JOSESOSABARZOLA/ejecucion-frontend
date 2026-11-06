/**
 * Microservicio: ejecucion
 * Módulo: Sorteo / Asignación (DME)
 * Feature: Tabla de ASIGNACIONES de un lote — a quién le tocó cada expediente (RECE-05)
 * Archivo: TablaAsignacionesLote.tsx
 * Responsabilidad: Enseñar EL REPARTO: por cada caso del lote, el expediente, el administrado, el
 *   DECISOR al que le tocó, la materia (deducida de sus infracciones) y el plazo.
 *
 *   Es el dato que faltaba. El DIRECTOR aprobaba un lote viendo solo "3 casos" — sin ver a qué
 *   decisor se asignó cada expediente, que es JUSTO EL ACTO que estaba validando. Y el acta D2 que se
 *   genera al aprobar SÍ lleva los nombres: el único que no los veía era QUIEN APRUEBA. Esta tabla es
 *   la misma en las dos bandejas (aprobación del director y consulta del secretario) precisamente
 *   para que las dos digan LO MISMO del mismo lote: un solo componente, no dos copias que divergen.
 *
 *   DEGRADACIÓN HONESTA (R-03-01-F) — UN CASO NUNCA DESAPARECE NI SE INVENTA UN NOMBRE. El backend
 *   resuelve el decisor con LEFT JOIN contra t_usuario; en modo REAL el user_id lo emite ASIGNACIONES
 *   y su mapeo con nuestro catálogo está SIN VERIFICAR. Cuando no resuelve:
 *     · hay id  → "Decisor #<id>" + "nombre no disponible". Se dice lo que se sabe y lo que no.
 *     · sin id  → "Sin decisor asignado" (badge de alerta): el caso está en el lote pero NO tiene a
 *                 quién; es una anomalía que el director TIENE que ver antes de aprobar, no algo que
 *                 esconder.
 *   Un INNER JOIN habría borrado esas filas y el director habría aprobado un lote incompleto sin
 *   enterarse — por eso la fila se pinta igual, con el hueco a la vista.
 *
 *   Solo componentes/estilos compartidos: la MISMA piel de tabla que el resto de la app
 *   (app-data-table-shell / app-data-table, tematizada en panels-theme.css), BadgePriority para el
 *   decisor y EmptyState/Alert para los bordes. Cero hex, solo tokens daisyUI.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-07-14
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-14/D-17: la columna «Submateria»
 *   pasa a «Materia» y pinta la materia DEDUCIDA del código de las infracciones del EPAS. El `subId`
 *   del reparto ya no se enseña: es un id crudo de Asignaciones, sin nombre local)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: solo comentarios. La materia del caso
 *   es la de Sorteo)
 */
import type { FC } from "react";
import BadgePriority from "../common/BadgePriority";
import EmptyState from "../common/EmptyState";
import Alert from "../common/Alert";
import type { SorteoLoteCaso } from "../../services/SorteoService";

interface TablaAsignacionesLoteProps {
  /** Casos del lote con su asignación (el backend los manda anidados en el lote). */
  casos: SorteoLoteCaso[];
  /**
   * Nº de casos que el ENCABEZADO del lote anuncia (totalCasos). Si no coincide con las filas que
   * llegaron, se avisa: el director está a punto de aprobar un reparto que no se le está mostrando
   * entero, y eso no puede pasar en silencio.
   */
  totalCasos?: number;
}

/** ¿El decisor de este caso quedó SIN RESOLVER? (ni nombre ni id: el caso no tiene a quién). */
const sinDecisor = (caso: SorteoLoteCaso): boolean =>
  caso.decisorUserId == null && !caso.decisorName?.trim();

const TablaAsignacionesLote: FC<TablaAsignacionesLoteProps> = ({
  casos,
  totalCasos,
}) => {
  // Sin casos no hay reparto que enseñar. No se finge una tabla vacía con cabeceras.
  if (casos.length === 0) {
    return (
      <EmptyState text="Este lote no tiene expedientes reflejados: no hay asignaciones que mostrar." />
    );
  }

  // El encabezado dice "N expedientes" y la tabla enseña otra cantidad: se DICE. El backend deriva las dos
  // cifras de la misma fuente (t_epas_sorteo), así que no debería pasar — y si pasa, el director
  // tiene que saber que lo que ve NO es el lote completo ANTES de aprobarlo.
  const faltanCasos = totalCasos != null && totalCasos !== casos.length;

  // Casos sin decisor resuelto: anomalía visible, nunca silenciada.
  const casosSinDecisor = casos.filter(sinDecisor).length;

  return (
    <div className="flex flex-col gap-3">
      {faltanCasos && (
        <Alert
          variant="warning"
          message={`Este lote declara ${totalCasos} expediente(s) pero solo se pudieron mostrar ${casos.length}. NO apruebe sin verificar el reparto completo.`}
        />
      )}

      {casosSinDecisor > 0 && (
        <Alert
          variant="warning"
          message={`${casosSinDecisor} expediente(s) del lote NO tienen decisor asignado. Revise el reparto antes de aprobarlo.`}
        />
      )}

      <div className="app-data-table-shell overflow-x-auto">
        <table className="app-data-table table w-full text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-base-content">
            <tr>
              <th>Expediente</th>
              <th>Administrado</th>
              <th>Decisor asignado</th>
              <th>Materia</th>
              <th>Plazo</th>
            </tr>
          </thead>
          <tbody>
            {casos.map((caso, i) => (
              <tr
                key={caso.eejeId}
                className={`border-b border-base-300 ${
                  i % 2 === 0 ? "bg-base-100" : "bg-base-200"
                } hover:bg-primary/5`}
              >
                <td className="py-3 font-semibold text-primary">
                  {caso.expNumber ?? `EPAS #${caso.eejeId}`}
                </td>
                <td className="py-3">{caso.administrado ?? "—"}</td>

                {/* EL DATO: a quién le tocó. Es lo que el director valida al aprobar. */}
                <td className="py-3">
                  {sinDecisor(caso) ? (
                    // Ni nombre ni id: el caso está en el lote y no tiene a quién. Se muestra como
                    // ALERTA (no se oculta la fila): es exactamente lo que hay que ver antes de aprobar.
                    <BadgePriority
                      text="Sin decisor asignado"
                      priority="alta"
                      size="md"
                      capitalize={false}
                    />
                  ) : (
                    <div className="flex flex-col gap-1">
                      <BadgePriority
                        // El nombre si resolvió; si no, el id — nunca un nombre inventado.
                        text={
                          caso.decisorName?.trim() ||
                          `Decisor #${caso.decisorUserId}`
                        }
                        priority="asignado"
                        size="md"
                        capitalize={false}
                      />
                      {/* El nombre NO resolvió contra el catálogo local (R-03-01-F): se dice, y se
                          deja el id a la vista para poder rastrearlo. */}
                      {!caso.decisorName?.trim() && (
                        <span className="text-xs italic text-warning">
                          nombre no disponible
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Materia de SORTEO de las infracciones del EPAS (quick 261104-jh1): el backend ya
                    la nombra. Sin infracciones con materia no hay nada que decir: «—». El `subId` del reparto NO se pinta:
                    es un id crudo de Asignaciones sin nombre local, y con su número parecería uno. */}
                <td className="py-3">{caso.materia ?? "—"}</td>

                <td className="py-3">
                  {caso.plazoDias != null ? `${caso.plazoDias} día(s)` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TablaAsignacionesLote;
