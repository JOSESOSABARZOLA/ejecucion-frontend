/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: La rama del correctivo en pantalla — tramo de la ESCALADA (Fase 03.18, Plan 06)
 * Archivo: AvisosDeActo.tsx
 * Responsabilidad: Pintar las `advertencias[]` que tres actos de la escalada —ordenar la
 *   sustitutoria, registrar la diligencia y liquidar los gastos— devuelven DENTRO de una respuesta
 *   2xx, y pintarlas de la única forma que no miente: como AVISO, DESPUÉS del éxito.
 *
 *   ── LA DOCTRINA, ESCRITA UNA SOLA VEZ Y AQUÍ: AVISAR, NO BLOQUEAR ────────────────────────────
 *   🔴 **UNA ADVERTENCIA NO ES UN ERROR.** Viaja en una respuesta de ÉXITO, sobre un hecho YA
 *   CONSUMADO: el acto se guardó, la fila existe, la bitácora lo registró. La rama de la obligación
 *   de hacer NO LLEVA GUARDS por decisión del área usuaria (2026-09-09) —«pasó de impedir a
 *   REGISTRAR FIELMENTE»—, y el backend lo dejó escrito en cada uno de los seis códigos del
 *   catálogo. Convertir aquí un aviso en un bloqueo, o pintarlo en rojo, reabriría esa decisión de
 *   tapadillo y en la peor forma posible: la pantalla diría que algo falló cuando no falló.
 *
 *   🔴 **Y LO PEOR NO ES EL COLOR, ES EL REINTENTO.** Un aviso que parece un error hace que el
 *   decisor vuelva a pulsar, y entonces hay DOS actos donde hubo uno — dos diligencias, o dos
 *   órdenes de pago sobre la misma deuda. Es literalmente lo que el servicio del backend anotó al
 *   componer el mensaje de la diligencia.
 *
 *   🔴 **PROHIBIDO LANZAR O CORTAR EL FLUJO POR UNA ADVERTENCIA.** Este componente sólo renderiza:
 *   no decide, no reintenta, no cierra nada y no tiene forma de impedir el acto — que ya ocurrió.
 *
 *   ── UN CÓDIGO DESCONOCIDO SE VE, NO SE ESCONDE ───────────────────────────────────────────────
 *   El CÓDIGO es lo estable —el backend lo dice en `advertencia-codigos.ts`—, la FRASE es para leer.
 *   Aquí se traduce cada código conocido a un titular en español; si llega uno que este archivo no
 *   conoce —porque una fase futura añadió otro al catálogo y nadie tocó la pantalla— se pinta el
 *   código TAL CUAL junto al mensaje del servidor. Una advertencia que no se entiende es mucho
 *   mejor que una advertencia que no se ve.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 */
import Alert from "../common/Alert";
import type { Advertencia } from "../../interfaces/IObligacionHacer";

/**
 * El titular en español de cada código que la pantalla sabe leer. La clave es el `codigo` del
 * catálogo cerrado del backend (`src/common/utils/advertencia-codigos.ts`).
 *
 * ⚠️ NO sustituye al mensaje del servidor: lo ENCABEZA. El mensaje del backend es el que trae las
 * cifras del caso concreto —cuántas multas constan, cómo terminó la última diligencia, con qué
 * número de orden quedó la deuda— y ésos son los datos con los que el decisor puede hacer algo.
 *
 * ⚠️ `TC_ARCHIVO_TOTAL_SOBRE_CUMPLIMIENTO_PARCIAL` NO está aquí a propósito: es del trabajo
 * comunitario (Fase 03.15) y ninguno de los cuatro actos de esta carpeta lo puede devolver. Si
 * alguna vez llegara, caería por el camino del código desconocido, que es justo lo que se quiere.
 *
 * 🔴 NO SE EXPORTA, y no es descuido: `react-refresh/only-export-components` sólo tolera exportar
 * constantes LITERALES junto a un componente, y esto es un objeto. Además no hace falta fuera —lo
 * que se comprueba desde una prueba es lo que se PINTA, no la tabla—.
 */
const TITULAR_ADVERTENCIA: Record<string, string> = {
  SUSTITUTORIA_SIN_LAS_TRES_MULTAS:
    "No constan las tres multas compulsorias que el art. 240 del COA prevé antes de la sustitutoria",
  SUSTITUTORIA_GASTOS_SIN_REAPERTURA:
    "La deuda quedó registrada, pero el expediente NO se pudo reabrir",
  DILIGENCIA_SIN_SUSTITUTORIA_ORDENADA:
    "No consta emitida la providencia de EJECUCIÓN SUSTITUTORIA que dispone la diligencia",
  GASTOS_SIN_DILIGENCIA_EJECUTADA:
    "Se está trasladando el costo de una ejecución que no consta EJECUTADA",
  ALEGACION_PENDIENTE_DE_RESOLVER:
    "Consta un escrito de alegación del administrado sin providencia que lo resuelva",
};

interface Props {
  /**
   * Lo que devolvió el servidor. 🔴 **AUSENTE significa «sin avisos»**: el backend nunca manda un
   * array vacío, para que nadie tenga que distinguir «no hay» de «no se calculó».
   */
  advertencias?: Advertencia[];
  /**
   * Qué acto se registró, en una frase. Va en el encabezado para que lo primero que se lea sea que
   * el acto SÍ quedó guardado — p. ej. «La orden de ejecución sustitutoria quedó registrada».
   */
  queSeRegistro: string;
}

/**
 * Los avisos de un acto YA REGISTRADO.
 *
 * Devuelve `null` cuando no hay nada que avisar: un recuadro vacío con un título de advertencia
 * sería un susto sin contenido.
 */
export const AvisosDeActo = ({ advertencias, queSeRegistro }: Props) => {
  if (!advertencias || advertencias.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {/* El encabezado dice DOS cosas y en este orden: que el acto se registró, y que lo que sigue
          son avisos. Al revés, el decisor lee primero el aviso y da por hecho que algo falló. */}
      <p className="text-sm font-medium">
        {queSeRegistro}. El servidor devolvió{" "}
        {advertencias.length === 1
          ? "un aviso sobre el expediente"
          : `${advertencias.length} avisos sobre el expediente`}
        : no impiden nada y no hay que repetir la operación —repetirla dejaría dos actos donde hubo
        uno—.
      </p>

      {advertencias.map((aviso, indice) => {
        const titular = TITULAR_ADVERTENCIA[aviso.codigo];

        return (
          <div
            key={`${aviso.codigo}-${indice}`}
            className="flex flex-col gap-1"
          >
            {/* 🔴 SIEMPRE `warning`, NUNCA `error`. El acto se guardó. */}
            <Alert
              variant="warning"
              message={titular ?? `Aviso del servidor (${aviso.codigo})`}
            />
            <p className="text-sm opacity-80">{aviso.mensaje}</p>
            {!titular && (
              // Un código que esta pantalla no conoce se ENSEÑA, con su nombre delante: es lo que
              // permite buscarlo en el catálogo del backend en vez de quedarse sin saber qué fue.
              <p className="text-xs opacity-60">
                Código no reconocido por esta pantalla: {aviso.codigo}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AvisosDeActo;
