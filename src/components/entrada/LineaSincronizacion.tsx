/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/entrada (frontend)
 * Feature: Estado de la sincronización automática con Resolución (Fase 03.24, Plan 07, D-10/D-13)
 * Archivo: LineaSincronizacion.tsx
 * Responsabilidad: Pintar, bajo el título de la Bandeja de Entrada, UNA línea con la última
 *   sincronización con Resolución: «Última sincronización: hace N minutos · correcta»,
 *   «… · con N fallo(s)», «… · falló: <motivo>», «Sincronizando…» mientras corre, o
 *   que aún no ha habido ninguna pasada. Los fallos, con su página o lote, van en el `title`.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-20
 *
 * ── 🔴 ESTE COMPONENTE NO DECIDE NADA. TRADUCE ────────────────────────────────────────────────
 * Lee `EstadoSincronizacionResolucion` tal como lo manda GET /entrada-lotes/sincronizacion (Plan 13).
 * No decide si una pasada fue correcta, parcial o fallida, ni cuenta fallos, ni recorta la lista:
 * todo eso lo hizo el servidor. Aquí solo se pone en palabras. Repetir una regla del backend en el
 * navegador es tener dos reglas que un día dirán cosas distintas de la misma pasada.
 *
 * ── 🔴 CON LA INTEGRACIÓN APAGADA NO CAMBIA NADA VISIBLE (D-10) ───────────────────────────────
 * `estado` null (aún no llegó, o el endpoint falló) o `habilitada: false` ⇒ `null`: ni línea, ni
 * hueco, ni aviso. Hoy, con la integración apagada, la Bandeja se ve igual que antes de esta fase.
 *
 * ── DE DÓNDE SALEN LOS TEXTOS Y LOS COLORES ───────────────────────────────────────────────────
 * Los textos fijos son constantes exportadas (las pruebas las importan). El resultado va en un
 * `BadgePriority` con las ranuras `default` (correcta), `media` (parcial) y `alta` (falló), como en
 * `CeldaInfracciones`: no se inventa un segundo sistema de etiquetas. Los motivos los pinta React
 * como texto y atributo, escapados; nunca `dangerouslySetInnerHTML` (T-03.24-24).
 *
 * ── 🔴 LA LÍNEA VISIBLE NO ES UNA REGIÓN VIVA (G-16) ──────────────────────────────────────────
 * Antes el `div` llevaba `role="status"` y el lector de pantalla anunciaba «hace N minutos» cada vez
 * que el hook refrescaba, o sea, cada minuto. Ahora la línea es texto normal y al lado vive un nodo
 * `sr-only` con `role="status"` que solo dice algo cuando CAMBIA el resultado (`anuncioDelCambio`).
 * El nodo está siempre montado mientras la línea se pinta: si se montara al tener algo que decir, el
 * lector no lo anunciaría.
 *
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 18, G-16: la línea visible pierde el
 *   `role="status"` y se añade el nodo vivo que anuncia solo el cambio de resultado)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-09: casos tardíos en el
 *   `title`)
 */
import { useState, type FC } from "react";
import { formatDistance, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import BadgePriority from "../common/BadgePriority";
import type {
  EstadoSincronizacionResolucion,
  FalloSincronizacion,
  ResultadoSincronizacion,
} from "../../services/EntradaLotesService";
import { anuncioDelCambio } from "./anuncioSincronizacion";

/** El comienzo de la línea cuando ya hubo al menos una pasada. */
export const PREFIJO_ULTIMA_SINCRONIZACION =
  "Última sincronización";
/** Mientras una pasada corre. */
export const TEXTO_SINCRONIZANDO = "Sincronizando…";
/** Desde que arrancó el backend no ha terminado ninguna pasada. */
export const TEXTO_SIN_PASADAS =
  "Aún no ha habido ninguna sincronización";

/**
 * G-09: el rótulo del bloque de casos tardíos en el `title`. Va aparte del de los fallos porque no lo
 * son: el caso llegó a un lote que ya salió a sorteo, y entra cuando Resolución lo mande en otro.
 */
export const TITULO_TARDIOS =
  "Casos que llegaron tarde a un lote ya sorteado (no son fallos; no entran hasta que Resolución los mande en un lote nuevo):";

const TEXTO_CORRECTA = "correcta";
const TEXTO_INCOMPLETA = "incompleta";
const TEXTO_FALLO = "falló";

type LineaSincronizacionProps = {
  /** El estado tal como lo mandó el servidor; null si aún no llegó o si la consulta falló. */
  estado: EstadoSincronizacionResolucion | null;
  /** «Ahora» para medir el «hace N»; solo lo fijan las pruebas. Por omisión, el reloj. */
  ahora?: Date;
};

/** «hace 3 minutos», contra `ahora` si llega o contra el reloj si no. */
const haceCuanto = (iso: string, ahora?: Date): string => {
  const fecha = new Date(iso);
  const opciones = { addSuffix: true, locale: es };
  return ahora
    ? formatDistance(fecha, ahora, opciones)
    : formatDistanceToNow(fecha, opciones);
};

/** «pág. 3 · lote 42 · caso 2313: motivo» — solo con lo que el fallo trae. */
const describirFallo = (fallo: FalloSincronizacion): string => {
  const donde = [
    fallo.pagina != null ? `pág. ${fallo.pagina}` : null,
    fallo.enloId != null ? `lote ${fallo.enloId}` : null,
    fallo.resolucionCasoId != null ? `caso ${fallo.resolucionCasoId}` : null,
  ].filter((parte): parte is string => parte !== null);
  return donde.length > 0
    ? `${donde.join(" · ")}: ${fallo.motivo}`
    : fallo.motivo;
};

/** El detalle del `title`: lo que entró, los fallos y si la lista o la pasada se quedaron cortas. */
const construirTitle = (estado: EstadoSincronizacionResolucion): string => {
  const lineas = [
    `Lotes: ${estado.lotes} · casos nuevos: ${estado.casosNuevos} · actualizados: ${estado.casosActualizados} · reingresados: ${estado.reingresados}`,
  ];
  if (estado.fallos.length > 0) {
    lineas.push("Fallos de la última sincronización:");
    for (const fallo of estado.fallos) {
      lineas.push(`- ${describirFallo(fallo)}`);
    }
    if (estado.fallosTotales > estado.fallos.length) {
      lineas.push(
        `(se muestran ${estado.fallos.length} de ${estado.fallosTotales})`,
      );
    }
  }
  // G-09: los casos tardíos, en su PROPIO bloque. No son fallos y no tocan la línea visible (L-5).
  const tardios = estado.tardios ?? [];
  if (tardios.length > 0) {
    lineas.push(TITULO_TARDIOS);
    for (const tardio of tardios) {
      lineas.push(`- ${describirFallo(tardio)}`);
    }
    const totalTardios = estado.casosTardios ?? tardios.length;
    if (totalTardios > tardios.length) {
      lineas.push(`(se muestran ${tardios.length} de ${totalTardios})`);
    }
  }
  if (estado.truncado) {
    lineas.push(
      "Había más páginas de las que se leen en una pasada; el resto entra en la siguiente.",
    );
  }
  return lineas.join("\n");
};

/** El badge del resultado: texto y ranura de color. */
const badgeDelResultado = (
  estado: EstadoSincronizacionResolucion,
): { texto: string; prioridad: "default" | "media" | "alta" } => {
  switch (estado.resultado) {
    case "PARCIAL":
      return {
        texto:
          estado.fallosTotales > 0
            ? `con ${estado.fallosTotales} fallo(s)`
            : TEXTO_INCOMPLETA,
        prioridad: "media",
      };
    case "FALLIDA":
      return {
        texto: estado.motivo ? `${TEXTO_FALLO}: ${estado.motivo}` : TEXTO_FALLO,
        prioridad: "alta",
      };
    default:
      return { texto: TEXTO_CORRECTA, prioridad: "default" };
  }
};

/**
 * La línea de estado de la sincronización con Resolución.
 */
const LineaSincronizacion: FC<LineaSincronizacionProps> = ({
  estado,
  ahora,
}) => {
  // ── El anuncio (G-16). Va ANTES del `return null` para que los hooks se llamen en cada render.
  // `resultadoVisto` es el último resultado TERMINADO que vio la línea (null: ninguno todavía).
  const [resultadoVisto, setResultadoVisto] =
    useState<ResultadoSincronizacion | null>(null);
  const [anuncio, setAnuncio] = useState("");

  const resultadoTerminado =
    estado && estado.habilitada && !estado.enCurso && estado.resultado !== "NUNCA"
      ? estado.resultado
      : null;

  // Patrón de React «ajustar el estado cuando cambia una prop», durante el render y no en un efecto:
  // solo cuando llega un resultado terminado DISTINTO del visto. En la primera lectura
  // `anuncioDelCambio` devuelve null y solo se guarda el resultado.
  if (
    estado &&
    resultadoTerminado !== null &&
    resultadoTerminado !== resultadoVisto
  ) {
    const texto = anuncioDelCambio(resultadoVisto, estado);
    setResultadoVisto(resultadoTerminado);
    if (texto !== null) setAnuncio(texto);
  }

  if (!estado || !estado.habilitada) {
    return null;
  }

  // Mientras corre una pasada, o si aún no terminó ninguna, la línea es solo texto: no hay
  // resultado que pintar ni detalle que poner en el `title`.
  const conResultado = !estado.enCurso && estado.resultado !== "NUNCA";

  // Vive dentro de `.app-section-header`, que tiene fondo oscuro en los dos temas: hereda el color
  // del cuerpo y no se leía. Toma el mismo primer plano que el título de la cabecera.
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--app-shell-chrome-fg)] opacity-80"
        title={conResultado ? construirTitle(estado) : undefined}
      >
        {conResultado ? (
          <ContenidoConResultado estado={estado} ahora={ahora} />
        ) : (
          <span>
            {estado.enCurso
              ? TEXTO_SINCRONIZANDO
              : `${TEXTO_SIN_PASADAS} · se sincroniza cada ${estado.intervaloMinutos} min`}
          </span>
        )}
      </div>
      {/* Lo único que el lector anuncia por su cuenta: el CAMBIO de resultado (G-16). */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {anuncio}
      </span>
    </>
  );
};

/** «Última sincronización: hace N minutos · <resultado>». */
const ContenidoConResultado: FC<{
  estado: EstadoSincronizacionResolucion;
  ahora?: Date;
}> = ({ estado, ahora }) => {
  const cuando = estado.fin ?? estado.inicio;
  const badge = badgeDelResultado(estado);
  return (
    <>
      <span>
        {cuando
          ? `${PREFIJO_ULTIMA_SINCRONIZACION}: ${haceCuanto(cuando, ahora)}`
          : PREFIJO_ULTIMA_SINCRONIZACION}
      </span>
      <span aria-hidden="true">·</span>
      <BadgePriority
        text={badge.texto}
        priority={badge.prioridad}
        size="sm"
        capitalize={false}
      />
    </>
  );
};

export default LineaSincronizacion;
