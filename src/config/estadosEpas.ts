/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/bandejas (frontend)
 * Feature: El catálogo de los 16 estados del EPAS en pantalla (Fase 03.19, Plan 07, D-10)
 * Archivo: estadosEpas.ts
 * Responsabilidad: Ser la ÚNICA fuente de la etiqueta legible y del chip de cada estado del EPAS.
 *   La consume la columna `ESTATUS` de la bandeja y la alimenta el filtro de catálogo de esa misma
 *   columna: `value` es el valor del enum, `label` es la etiqueta de aquí.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-21
 * Modificado por: Andrés Miño — 2026-10-12 (RECURSO_ACEPTADO: el recurso aceptado sale con destino)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, Plan 20 — G-04: `estaAntesDelSorteo`)
 * Modificado por: Andrés Miño — 2026-10-28 (DMI pasa a llamarse DMIT)
 *
 * ── 🔴 LOS 16 VALORES SON EL ENUM DEL BACKEND: ESTO ES CONTRATO COMPARTIDO ────────────────────
 * Espejan, palabra por palabra, `EpasState` de
 * `ejecucion-backend/src/modules/ejecucion/epas/interfaces/epas-state.enum.ts`, que a su vez espeja
 * el catálogo `t_epas_estado`. No son una lista de presentación que se pueda ampliar por gusto:
 * inventar aquí un estado 17 significaría filtrar por un valor que el servidor no reconoce, y el
 * filtro devolvería cero filas sin decir por qué. Si el backend añade un estado, se añade aquí —y
 * la prueba de totalidad de `estadosEpas.test.ts` falla hasta que se haga.
 *
 * ⚠️ `InboxActionStatus` (`inboxActionStatusRules.ts`) NO es una segunda lista de estados: es el
 * SUBCONJUNTO de siete que abre o cierra acciones de bandeja. Este catálogo es el enum completo, y
 * una prueba afirma que aquel sigue contenido en este.
 *
 * ── 🔴 TRES FAMILIAS COMPARTEN AZULES A PROPÓSITO ────────────────────────────────────────────
 * «En trámite», «En ejecución» y «Antesala» reparten `badge-neutral`, `badge-info` y
 * `badge-soft badge-info`, que a ojo son tres azules parecidos. No es un descuido: distinguir las
 * familias por MATIZ sería codificar el significado en el color, y entonces quien no distingue esos
 * azules —o quien imprime la pantalla en blanco y negro— perdería la información. El significado lo
 * lleva el chip COMO TEXTO; el color solo acompaña. Por la misma razón `PENDIENTE_ARCHIVO` comparte
 * valor con el chip por defecto de `BadgePriority` sin que eso sea un fallo.
 *
 * ── 🔴 `EN_EJECUCION_HACER` ES UNA ETIQUETA HISTÓRICA ────────────────────────────────────────
 * Ningún EPAS puede estar en ese estado hoy, y no va a poder: la Fase 03.16 decidió que la rama del
 * correctivo NO es una máquina de estados sino un registro de actos, así que ese valor del catálogo
 * se quedó sin transiciones. Se le da etiqueta igualmente —«Etiqueta histórica»— porque el valor
 * SIGUE EXISTIENDO en `t_epas_estado` y un dato viejo podría traerlo: enseñarlo crudo sería peor
 * que enseñarlo explicado.
 *
 * ── DE DÓNDE SALEN LOS COLORES ───────────────────────────────────────────────────────────────
 * De `BadgePriority` y su `BADGE_GROUPS`, que es EL sistema de etiquetas del módulo. No se inventa
 * un segundo: `BADGE_GROUPS` se EXTIENDE volcando `CHIP_ESTADO_EPAS` dentro, de modo que el mapa
 * sigue siendo uno solo y este archivo es el trozo del mapa que habla de estados del EPAS.
 */

/**
 * Los 16 estados del EPAS, en el orden del enum del backend (2026-10-12: entra RECURSO_ACEPTADO).
 *
 * `as const` para que `EstadoEpas` se derive de aquí y los dos `Record` de abajo sean TOTALES: si
 * falta una clave, el compilador lo dice antes que la prueba.
 */
export const ESTADOS_EPAS = [
  "RECIBIDO",
  "VERIFICADO",
  "SORTEADO",
  "ASIGNADO_DECISOR",
  "EN_VERIFICACION_PAGO",
  "PENDIENTE_COACTIVA",
  "CUMPLIDO",
  "PENDIENTE_ARCHIVO",
  "ARCHIVADO",
  "DEVUELTO_DMR",
  "DEVUELTO_POR_NULIDAD",
  "RECURSO_ACEPTADO",
  "EN_IMPUGNACION",
  "EN_PRESCRIPCION",
  "EN_EJECUCION_HACER",
  "EN_TRABAJO_COMUNITARIO",
] as const;

/** Un estado del EPAS, tal y como viaja en `eejeStatus`. */
export type EstadoEpas = (typeof ESTADOS_EPAS)[number];

/**
 * Los chips que `BadgePriority` sabe pintar y que este catálogo usa. Es un SUBCONJUNTO del
 * `BadgetType` de `BadgePriority`; se escribe aquí en vez de importarse para que la dependencia
 * entre los dos archivos vaya en un solo sentido (`BadgePriority` → `estadosEpas`) y no haya ciclo.
 */
export type ChipEstadoEpas =
  | "badge-neutral"
  | "badge-info"
  | "badge-warning"
  | "badge-success"
  | "badge-error"
  | "badge-soft badge-info";

/**
 * ESTADO → ETIQUETA LEGIBLE. Un chip no debe leer `EN_VERIFICACION_PAGO`.
 *
 * Varias son FRASES y no palabras sueltas, así que quien las pinte tiene que pasar
 * `capitalize={false}` a `BadgePriority`: con el `capitalize` por defecto el CSS convierte
 * «En verificación de pago» en «En Verificación De Pago».
 */
export const ETIQUETA_ESTADO_EPAS: Record<EstadoEpas, string> = {
  // ── En trámite: el expediente todavía está colocándose ──
  RECIBIDO: "Recibido",
  VERIFICADO: "Verificado",
  SORTEADO: "Sorteado",
  ASIGNADO_DECISOR: "Asignado",
  // ── En ejecución: el decisor ya está trabajándolo ──
  EN_VERIFICACION_PAGO: "En verificación de pago",
  EN_TRABAJO_COMUNITARIO: "En trabajo comunitario",
  // ── Detenido: algo externo suspendió el avance ──
  EN_IMPUGNACION: "En impugnación",
  EN_PRESCRIPCION: "En prescripción",
  // ── Escalada ──
  PENDIENTE_COACTIVA: "Pendiente de coactiva",
  // ── Antesala del archivo: el trámite terminó, el físico aún no salió a Secretaría General ──
  PENDIENTE_ARCHIVO: "Pendiente de archivo",
  // ── Logrado ──
  CUMPLIDO: "Cumplido",
  ARCHIVADO: "Archivado",
  // ── Sale del módulo. 🔴 Los tres NO son lo mismo: `DEVUELTO_DMR` es un defecto documental
  //    detectado antes de sortear; `DEVUELTO_POR_NULIDAD` es una nulidad declarada por la
  //    Procuraduría sobre un expediente ya asignado, y puede ir a la DMR o a la DMIT;
  //    `RECURSO_ACEPTADO` (2026-10-12) es el recurso que la Procuraduría ACEPTÓ, y el decisor eligió
  //    si va a la DMIT (Instrucción), a la DMR (Resolución) o al archivo (Secretaría General). ──
  DEVUELTO_DMR: "Devuelto a la DMR",
  DEVUELTO_POR_NULIDAD: "Devuelto por nulidad",
  RECURSO_ACEPTADO: "Recurso aceptado",
  // ── Sin transiciones, y sin que vayan a existir (ver cabecera) ──
  EN_EJECUCION_HACER: "Etiqueta histórica",
};

/**
 * ESTADO → CHIP. El rojo está reservado a los tres estados en los que el expediente SALE del módulo;
 * el ámbar, a los tres en los que el avance está detenido o escalado. Ninguno de los dos es
 * decorativo: son las dos situaciones que cambian lo que el decisor puede hacer hoy.
 */
export const CHIP_ESTADO_EPAS: Record<EstadoEpas, ChipEstadoEpas> = {
  RECIBIDO: "badge-neutral",
  VERIFICADO: "badge-neutral",
  SORTEADO: "badge-info",
  ASIGNADO_DECISOR: "badge-neutral",
  EN_VERIFICACION_PAGO: "badge-info",
  EN_TRABAJO_COMUNITARIO: "badge-info",
  EN_IMPUGNACION: "badge-warning",
  EN_PRESCRIPCION: "badge-warning",
  PENDIENTE_COACTIVA: "badge-warning",
  PENDIENTE_ARCHIVO: "badge-soft badge-info",
  CUMPLIDO: "badge-success",
  ARCHIVADO: "badge-success",
  DEVUELTO_DMR: "badge-error",
  DEVUELTO_POR_NULIDAD: "badge-error",
  RECURSO_ACEPTADO: "badge-error",
  EN_EJECUCION_HACER: "badge-soft badge-info",
};

/**
 * La etiqueta legible de un estado, con *fallback* AL VALOR CRUDO.
 *
 * 🔴 Nunca devuelve `undefined`, y nunca devuelve cadena vacía para un estado que sí llegó: si el
 * servidor manda un valor que este catálogo no conoce —porque el backend añadió un estado y el
 * frontend todavía no—, se enseña el valor tal cual. Un `EN_LO_QUE_SEA` en pantalla es feo, pero
 * dice la verdad y es rastreable; una celda vacía haría creer que el expediente no tiene estado
 * (T-03.19-30: el valor crudo no es dato personal).
 *
 * Sin estado (ausente o cadena vacía) devuelve cadena vacía, que es lo que `BadgePriority`
 * interpreta como «no pintes nada»: eso sí es la ausencia del dato, y no se disfraza de estado.
 */
export const etiquetaEstadoEpas = (valor: string | undefined): string => {
  if (!valor) return "";
  return ETIQUETA_ESTADO_EPAS[valor as EstadoEpas] ?? valor;
};

/**
 * ── ANTES DEL SORTEO (Fase 03.24, Plan 20 — G-04) ─────────────────────────────────────────────
 *
 * Los estados en los que el EPAS todavía NO ha pasado por el sorteo: recién recibido, verificado,
 * o devuelto a la DMR antes de sortearse. El conjunto vive aquí, en un solo sitio, y no suelto en la
 * página que lo consulta.
 *
 * 🔴 No es una regla de negocio: solo decide qué frase enseña la línea de tiempo abierta desde la
 * Bandeja de Entrada (la nota neutra en vez del aviso de «sin identificador de asignación»).
 */
export const ESTADOS_ANTES_DEL_SORTEO: readonly EstadoEpas[] = [
  "RECIBIDO",
  "VERIFICADO",
  "DEVUELTO_DMR",
];

/** `true` si el estado está en `ESTADOS_ANTES_DEL_SORTEO`. Sin estado ⇒ `false`: no se presume. */
export const estaAntesDelSorteo = (eejeStatus?: string | null): boolean =>
  eejeStatus != null &&
  (ESTADOS_ANTES_DEL_SORTEO as readonly string[]).includes(eejeStatus);

/**
 * ── FAMILIAS DE ESTADO, PARA AGREGAR (Tablero de indicadores, 2026-10-02) ─────────────────────
 *
 * Quince estados no caben en un gráfico: un anillo con quince porciones no se lee. Estas son las
 * familias que ESTE MISMO catálogo ya documenta en los comentarios de `ETIQUETA_ESTADO_EPAS` —«En
 * trámite», «En ejecución», «Detenido», «Escalada», «Antesala del archivo», «Logrado», «Sale del
 * módulo»—, aquí hechas dato para poder contar por ellas.
 *
 * 🔴 EL BACKEND NO AGRUPA, Y ESO ES LA DECISIÓN. `GET /dashboard` devuelve el conteo por estado
 * CRUDO; agrupar aquí mantiene una sola fuente de vocabulario. Si el backend tradujera o agrupara,
 * habría dos listas de estados en dos repos que tendrían que decir lo mismo para siempre — que es
 * literalmente el agujero del backlog 999.1.
 *
 * `Detenido` y `Escalada` se funden en una sola familia: las dos significan «el expediente no
 * avanza por su camino normal» y separarlas dejaba dos porciones de dos y cuatro expedientes que no
 * se distinguían a ojo.
 */
export const FAMILIAS_ESTADO_EPAS = [
  "En trámite",
  "En ejecución",
  "Detenido o escalado",
  "Antesala del archivo",
  "Logrado",
  "Fuera del módulo",
] as const;

export type FamiliaEstadoEpas = (typeof FAMILIAS_ESTADO_EPAS)[number];

/** ESTADO → FAMILIA. Total sobre `EstadoEpas`: si falta una clave, lo dice el compilador. */
export const FAMILIA_ESTADO_EPAS: Record<EstadoEpas, FamiliaEstadoEpas> = {
  RECIBIDO: "En trámite",
  VERIFICADO: "En trámite",
  SORTEADO: "En trámite",
  ASIGNADO_DECISOR: "En trámite",
  EN_VERIFICACION_PAGO: "En ejecución",
  EN_TRABAJO_COMUNITARIO: "En ejecución",
  // Sin transiciones y sin que vayan a existir, pero el valor sigue en `t_epas_estado` y un dato
  // viejo podría traerlo: se agrupa donde su nombre dice, no en un cajón aparte.
  EN_EJECUCION_HACER: "En ejecución",
  EN_IMPUGNACION: "Detenido o escalado",
  EN_PRESCRIPCION: "Detenido o escalado",
  PENDIENTE_COACTIVA: "Detenido o escalado",
  PENDIENTE_ARCHIVO: "Antesala del archivo",
  CUMPLIDO: "Logrado",
  ARCHIVADO: "Logrado",
  DEVUELTO_DMR: "Fuera del módulo",
  DEVUELTO_POR_NULIDAD: "Fuera del módulo",
  // 2026-10-12: la familia de su hermano de rama. Con destino Archivo acabará ARCHIVADO al salir su
  // lote, pero mientras espera ya no es trabajo del decisor.
  RECURSO_ACEPTADO: "Fuera del módulo",
};

/**
 * FAMILIA → TOKEN DE COLOR. Los mismos tokens que ya usa el resto del módulo (`src/index.css`), no
 * una paleta nueva. El rojo queda para lo que SALE del módulo y el ámbar para lo que no avanza, que
 * es el mismo criterio que `CHIP_ESTADO_EPAS` aplica estado por estado.
 */
export const COLOR_FAMILIA_ESTADO_EPAS: Record<FamiliaEstadoEpas, string> = {
  "En trámite": "--color-info",
  "En ejecución": "--color-primary",
  "Detenido o escalado": "--color-warning",
  "Antesala del archivo": "--color-secondary",
  Logrado: "--color-success",
  "Fuera del módulo": "--color-error",
};

/** Qué significa cada familia, para la leyenda del gráfico. */
export const RESUMEN_FAMILIA_ESTADO_EPAS: Record<FamiliaEstadoEpas, string> = {
  "En trámite": "Entró y todavía se está colocando: verificar, sortear, asignar.",
  "En ejecución": "El decisor ya lo está trabajando.",
  "Detenido o escalado": "No avanza por su camino normal: impugnado, prescrito o en coactiva.",
  "Antesala del archivo": "El trámite terminó; el físico aún no salió a Secretaría General.",
  Logrado: "Cumplido o ya archivado.",
  "Fuera del módulo":
    "Devuelto a la DMR o a la DMIT, o con el recurso aceptado y saliendo hacia su destino; dejó de ser trabajo de Ejecución.",
};

/**
 * Agrupa un conteo por estado crudo en las seis familias, descartando las vacías.
 *
 * 🔴 Un estado que este catálogo NO conozca —porque el backend añadió uno y el frontend todavía
 * no— NO se descarta: cae en «En trámite» sería mentir, así que se devuelve con su valor crudo como
 * familia propia. Un `EN_LO_QUE_SEA` en la leyenda es feo, pero dice la verdad y es rastreable;
 * perderlo haría que los totales del gráfico no cuadraran con los de arriba sin explicación.
 */
export type FilaFamilia = {
  /** La familia, o el estado crudo si el catálogo no lo conoce. */
  label: string;
  value: number;
  colorToken: string;
  summary: string;
};

export const agruparPorFamilia = (
  conteo: { estado: string; total: number }[],
): FilaFamilia[] => {
  const acumulado = new Map<string, number>();

  for (const fila of conteo) {
    const familia =
      FAMILIA_ESTADO_EPAS[fila.estado as EstadoEpas] ?? fila.estado;
    acumulado.set(familia, (acumulado.get(familia) ?? 0) + fila.total);
  }

  const conFamilia: FilaFamilia[] = FAMILIAS_ESTADO_EPAS.flatMap((familia) => {
    const value = acumulado.get(familia) ?? 0;
    acumulado.delete(familia);
    return value > 0
      ? [
          {
            label: familia,
            value,
            colorToken: COLOR_FAMILIA_ESTADO_EPAS[familia],
            summary: RESUMEN_FAMILIA_ESTADO_EPAS[familia],
          },
        ]
      : [];
  });

  // Lo que quedó sin familia conocida, al final y sin disfraz.
  const desconocidas: FilaFamilia[] = [...acumulado.entries()].map(
    ([estado, value]) => ({
      label: estado,
      value,
      colorToken: "--color-neutral",
      summary: "Estado que este catálogo todavía no conoce.",
    }),
  );

  return [...conFamilia, ...desconocidas];
};
