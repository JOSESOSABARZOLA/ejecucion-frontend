/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/epas (frontend)
 * Feature: Observaciones por campo y por documento del expediente
 * Archivo: ICaseObservations.ts
 * Responsabilidad: La forma de una observación y los cuatro helpers con los que la ficha decide qué
 *   puede hacer el usuario: si el objetivo pulsado ya tiene una, cuántas hay, y si lo que se está
 *   viendo coincide con lo que está guardado en el servidor.
 *
 *   Portado de `resolucion-frontend/src/shared/domain/types/ICaseObservations.ts`, PERO CON FORMA DE
 *   LISTA y no con los dos `Record` de allí. 🔴 La diferencia no es de gusto: aquí las observaciones
 *   PERSISTEN en el servidor y traen `obseId`, autor y fecha. Un `Record<clave, texto>` perdería las
 *   tres cosas, y el autor es justo lo que el área pidió poder ver.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-18
 * Modificado por: Andrés Miño — 2026-10-19 (UAT 03.23-14: `conBorrador`, la caja entra en la lista
 *   sin botón propio)
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-01)
 */

/** Qué se observó. Espeja el CHECK de `t_expediente_observacion.obse_tipo`. */
export type ObservacionTipo = "CAMPO" | "DOCUMENTO";

/**
 * En qué punto de la REVISIÓN DEL DIRECTOR está la observación (2026-09-18). Espeja el CHECK
 * `chk_obse_estado` de la base y el enum `ObservacionEstado` del backend.
 *
 * El secretario abogado anota; el director —que firma el memorando con el que el expediente sale—
 * decide cuáles se le dicen a la otra dirección. Mientras alguna esté PENDIENTE, su expediente NO se
 * puede despachar desde la Bandeja de Salida.
 */
export type ObservacionEstado = "PENDIENTE" | "APROBADA" | "RECHAZADA";

/** El veredicto que el director manda al servidor. `PENDIENTE` no es un veredicto: es no haber actuado. */
export interface IRevisionObservacion {
  obseId: number;
  estado: Extract<ObservacionEstado, "APROBADA" | "RECHAZADA">;
  /** Obligatorio al rechazar y prohibido al aprobar (lo imponen el servicio y el CHECK de la base). */
  motivoRechazo?: string;
}

/**
 * Una observación, tal y como viaja del backend y vuelve a él.
 *
 * `obseId` es opcional porque una observación recién añadida en pantalla todavía no lo tiene: se lo
 * pone la base al guardar. Lo que la identifica mientras tanto —y también después— es su OBJETIVO
 * (`tipo` + `clave`), que es la clave única de la tabla.
 */
export interface IObservacion {
  obseId?: number;
  tipo: ObservacionTipo;
  /** Nombre camelCase del campo en `EnvioLoteCaso`, o el `docId` EN TEXTO si es un documento. */
  clave: string;
  /** El rótulo TAL Y COMO SE VE en pantalla. Es lo que se imprime en el memorando. */
  etiqueta: string;
  texto: string;
  /**
   * La revisión del director (2026-09-18). Opcional porque una observación recién añadida EN
   * PANTALLA todavía no ha viajado al servidor y no tiene ninguna: cuando falta, se lee como
   * `PENDIENTE`, que es como nace en la base.
   *
   * 🔴 VUELVE A `PENDIENTE` SI EL TEXTO CAMBIA, y eso lo hace el servidor. Corregir una observación
   * aprobada la devuelve a la cola: ya no es la que el director aprobó.
   */
  estado?: ObservacionEstado;
  /** Por qué el director la desechó. Solo viene en las RECHAZADAS, y ahí nunca falta. */
  motivoRechazo?: string;
  /** Cuándo la revisó. Solo en las revisadas. */
  revisadoAt?: string;
  /**
   * `usu_id` de quien la anotó. Opcional por la misma razón que `estado`: una observación recién
   * escrita en pantalla todavía no tiene autor asignado.
   *
   * 🔴 ES LO QUE DECIDE SI EL DIRECTOR PUEDE REVISARLA. Él también anota —su triage por expediente
   * completo lo exige— y no se aprueba a sí mismo: las suyas nacen ya consentidas y el modal de
   * revisión no le ofrece botones sobre ellas. El servidor lo impone igual.
   */
  createdBy?: number;
  /**
   * Verdadera si la observación quedó CONGELADA en una devolución anterior y el expediente ha
   * vuelto reingresado (Fase 03.24, G-01). Ausente equivale a falsa: una observación nueva.
   *
   * UI-SPEC §1.7: el servidor los decide; la pantalla los pinta.
   */
  deDevolucionAnterior?: boolean;
  /**
   * Si la DMR cumplió lo que se le pidió. Solo viene en las de la devolución anterior; cuando falta
   * en una de ellas, se lee como `POR_VERIFICAR`.
   *
   * UI-SPEC §1.7: el servidor los decide; la pantalla los pinta.
   */
  verificacion?: ObservacionVerificacion;
  /** Cuándo se verificó. UI-SPEC §1.7: el servidor los decide; la pantalla los pinta. */
  verificadaAt?: string;
  /**
   * Nombre de quien la verificó, para la línea «Verificada por…». UI-SPEC §1.7: el servidor los
   * decide; la pantalla los pinta.
   */
  verificadaPorNombre?: string;
}

/**
 * La verificación de una observación de la devolución anterior (Fase 03.24, G-01): ¿la DMR corrigió
 * lo que le pedimos? Espeja el enum `ObservacionVerificacion` del backend. Es un eje DISTINTO de la
 * revisión (`ObservacionEstado`): aquella decide si una observación nueva viaja a la DMR; esta, si
 * la DMR cumplió una que ya viajó.
 */
export type ObservacionVerificacion = "POR_VERIFICAR" | "CUMPLIDA" | "NO_CUMPLIDA";

/**
 * Reparte la lista que llega del servidor: las de la devolución anterior (solo lectura, se
 * verifican) y las nuevas (se escriben, se borran y se revisan). Conserva el orden de llegada, que
 * es la numeración con que se citan. Sin `deDevolucionAnterior`, la observación es nueva.
 */
export const separarObservaciones = (
  lista: IObservacion[],
): { anteriores: IObservacion[]; nuevas: IObservacion[] } => {
  const anteriores: IObservacion[] = [];
  const nuevas: IObservacion[] = [];
  for (const observacion of lista) {
    if (observacion.deDevolucionAnterior === true) anteriores.push(observacion);
    else nuevas.push(observacion);
  }
  return { anteriores, nuevas };
};

/**
 * Cuántas observaciones de la devolución anterior hay en cada estado de verificación. Una sin
 * `verificacion` cuenta como por verificar.
 *
 * 🔴 Contar para PINTAR («· N por verificar» y el aviso de la ficha) está permitido; DECIDIR con
 * esto, no. Si el expediente pasa a «Por devolver» o sigue su curso lo decide el servidor (Planes
 * 21, 22 y 25), y la fila lo lee de sus campos.
 */
export const contarVerificaciones = (
  anteriores: IObservacion[],
): { total: number; porVerificar: number; cumplidas: number; noCumplidas: number } => {
  let porVerificar = 0;
  let cumplidas = 0;
  let noCumplidas = 0;
  for (const observacion of anteriores) {
    const verificacion = observacion.verificacion ?? "POR_VERIFICAR";
    if (verificacion === "CUMPLIDA") cumplidas += 1;
    else if (verificacion === "NO_CUMPLIDA") noCumplidas += 1;
    else porVerificar += 1;
  }
  return { total: anteriores.length, porVerificar, cumplidas, noCumplidas };
};

/**
 * Lo que se está escribiendo en la caja del panel: un objetivo elegido y un texto a medias. Pasa a
 * la lista sin botón propio (2026-10-19): al pulsar otro objetivo o «Guardar observaciones». Ver
 * `conBorrador`.
 */
export interface IObservacionBorrador {
  tipo: ObservacionTipo;
  clave: string;
  etiqueta: string;
  texto: string;
}

/** Un borrador en blanco: sin objetivo, la caja de texto queda deshabilitada y lo dice. */
export const crearBorradorVacio = (): IObservacionBorrador => ({
  tipo: "CAMPO",
  clave: "",
  etiqueta: "",
  texto: "",
});

/** ¿El expediente tiene algo anotado? Es lo que decide si se puede devolver. */
export const tieneObservaciones = (observaciones: IObservacion[]): boolean =>
  observaciones.length > 0;

/** Cuántas. Va en la línea «Total de observaciones guardadas: N» del panel. */
export const contarObservaciones = (observaciones: IObservacion[]): number =>
  observaciones.length;

/**
 * La observación de ESE objetivo, si ya existe.
 *
 * 🔴 ES LA REGLA «UNA OBSERVACIÓN POR OBJETIVO», la misma que la base impone con su índice único. La
 * pantalla la aplica para no dejar escribir una segunda sobre un campo ya observado; la base la
 * aplica para que no pueda ocurrir aunque la pantalla falle.
 */
export const buscarObjetivo = (
  observaciones: IObservacion[],
  tipo: ObservacionTipo,
  clave: string,
): IObservacion | undefined =>
  observaciones.find((o) => o.tipo === tipo && o.clave === clave);

/**
 * La lista CON lo que está escrito en la caja, si cuenta como observación nueva: objetivo elegido,
 * texto no vacío y objetivo aún sin observar. Si no, la misma lista.
 *
 * 🔴 Desde el 2026-10-19 (UAT 03.23-14) el panel ya no tiene el botoncito de «añadir a la lista»,
 * que nadie veía: lo escrito se daba por guardado y se perdía. Ahora es la ÚNICA regla que decide
 * cuándo la caja entra en la lista —al cambiar de objetivo, al guardar y al calcular si hay algo
 * sin guardar—, y por eso vive aquí y no repetida en la ficha.
 */
export const conBorrador = (
  observaciones: IObservacion[],
  borrador: IObservacionBorrador,
): IObservacion[] => {
  const texto = borrador.texto.trim();
  if (!borrador.clave || texto.length === 0) return observaciones;
  if (buscarObjetivo(observaciones, borrador.tipo, borrador.clave)) {
    return observaciones;
  }
  return [
    ...observaciones,
    {
      tipo: borrador.tipo,
      clave: borrador.clave,
      etiqueta: borrador.etiqueta,
      texto,
    },
  ];
};

/**
 * ¿Lo que se está viendo es lo que está guardado?
 *
 * Es lo que decide si el aviso de la ficha va en VERDE («se han guardado N observaciones») o en
 * ámbar («hay cambios sin guardar»). 🔴 Compara por `tipo + clave + texto` y NO por identidad de
 * arreglo: cada `setState` crea un arreglo nuevo, así que una comparación por referencia diría
 * «cambió» siempre y el aviso nunca se pondría verde.
 *
 * El ORDEN no cuenta: dos listas con las mismas observaciones en distinto orden describen el mismo
 * expediente, y el servidor las devuelve ordenadas por su id, que no tiene por qué coincidir con el
 * orden en que se añadieron en pantalla.
 */
export const sonIguales = (
  a: IObservacion[],
  b: IObservacion[],
): boolean => {
  if (a.length !== b.length) return false;

  return a.every((observacion) => {
    const gemela = buscarObjetivo(b, observacion.tipo, observacion.clave);
    return gemela?.texto === observacion.texto;
  });
};

/**
 * El estado de una observación, LEÍDO CON SU DEFECTO (2026-09-18).
 *
 * 🔴 Un solo sitio donde `undefined` se convierte en `PENDIENTE`. La lista mezcla observaciones
 * recién escritas en pantalla —que aún no tienen estado— con las que vuelven del servidor, y cada
 * comparación suelta contra `undefined` sería una ocasión de tratar lo no revisado como revisado.
 */
export const estadoDe = (observacion: IObservacion): ObservacionEstado =>
  observacion.estado ?? "PENDIENTE";

/** Cuántas esperan todavía el veredicto del director. Es lo que bloquea el despacho. */
export const contarPendientes = (observaciones: IObservacion[]): number =>
  observaciones.filter((o) => estadoDe(o) === "PENDIENTE").length;

/** Cuántas hizo suyas el director: son las que se imprimen en el memorando de devolución. */
export const contarAprobadas = (observaciones: IObservacion[]): number =>
  observaciones.filter((o) => estadoDe(o) === "APROBADA").length;
