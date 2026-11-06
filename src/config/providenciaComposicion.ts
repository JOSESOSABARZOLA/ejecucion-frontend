/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Composición de providencias (Fase 03.14, Plan 06 · Fase 03.15, Plan 06)
 * Archivo: providenciaComposicion.ts
 * Responsabilidad: Las reglas PURAS del modal de composición — qué secciones hay, qué tokens se
 *   pueden insertar y con qué valor, y cómo se arma el cuerpo de la petición. Sin React y sin red,
 *   para poder fijarlas con tests.
 *
 *   ── LOS TOKENS SOLO OFRECEN LO QUE DE VERDAD SABEMOS ─────────────────────────────────────────
 *   La plantilla lista un juego amplio (`{Multa en letras}`, `{Orden de Pago}`, `{Administración
 *   Zonal}`…), pero esos datos viven en Core y hoy el módulo NO los tiene (es la Fase 5). Ofrecer un
 *   badge que inserta un hueco vacío sería peor que no ofrecerlo: el decisor creería que el sistema
 *   puso el dato. Así que la paleta se deriva del propio caso y crece cuando crezcan los datos.
 *
 *   ── Y DESDE LA FASE 03.15 CRECE TAMBIÉN CON LO QUE SE ESTÁ TECLEANDO ────────────────────────
 *   D-5 abrió dos puertas para la prueba: el comprobante puede constar ya en el expediente, o
 *   aportarse EN EL MISMO ACTO desde el modal de emisión. Los tokens de la prueba
 *   ({Fecha de pago}, {Transacción}) tienen por eso **dos orígenes**, y el caso de la bandeja
 *   —MiEpasAsignado— no trae ninguno de los dos. De ahí el `ContextoTokens`: el segundo argumento
 *   opcional por el que el modal entrega los dos orígenes YA MEZCLADOS.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-14
 * Modificado por: Andrés Miño — 2026-10-06 (quick 261006-kys, D-01: {Materia} pasó a resolver con la
 *   materia del expediente y entró {Submateria}, los dos desde el expediente y no desde el reparto;
 *   la cabecera toma la materia también del expediente)
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 17 — D-17/D-00b: solo comentarios. La
 *   lógica no cambia —{Materia}/{Submateria} y la cabecera siguen leyendo `expMateria` y
 *   `expSubmateria`—, pero esos dos campos son ahora la materia y la(s) submateria(s) DEDUCIDAS por el
 *   servidor del código de las infracciones del EPAS; varias llegan ya unidas y se imprimen tal cual)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261104-jh1: solo comentarios. {Materia} y
 *   {Submateria} son nombres de Sorteo; «Sin materia» nunca llega a un documento)
 */

import type { MiEpasAsignado } from "../services/SorteoService";

/**
 * El cuerpo de la providencia: UNA sola caja de texto enriquecido.
 *
 * ── POR QUÉ UNA Y NO TRES (área usuaria, 2026-09-03) ─────────────────────────────────────────
 * Había tres secciones —antecedentes, cuadro y disposiciones— y el backend les ponía título y
 * numeración (`I. PRINCIPALES ANTECEDENTES`, `1.1`, `2.1 PRIMERO:`). Los decisores no redactan por
 * partes: traen la providencia escrita, la pegan entera y la ajustan. Trocearla a mano para meterla
 * en tres cajas era trabajo añadido, y encima el sistema renumeraba lo que el documento ya traía.
 *
 * Ahora **manda el editor**: lo que se ve aquí es lo que sale en el PDF. El backend no numera ni
 * titula nada del cuerpo (`SECCION_CUERPO` en `providencia.service.ts`), así que la conformidad con
 * la plantilla es de quien redacta.
 */
export const SECCION_CUERPO = {
  clave: "cuerpo",
  etiqueta: "Cuerpo de la providencia",
  ayuda:
    "Escriba o pegue aquí la providencia completa, con sus títulos y su numeración: se imprime tal cual. Conserva negrita, cursiva, subrayado, títulos, viñetas y listas numeradas.",
} as const;

/**
 * Marcador que dice DÓNDE va el cuadro de horas que genera el sistema.
 *
 * ⚠️ Espeja `MARCADOR_CUADRO` de
 * `ejecucion-backend/src/modules/ejecucion/providencias/application/providencia.service.ts`. Si
 * cambia el literal, cambia en los dos o el cuadro deja de salir sin decir por qué.
 *
 * Su presencia es la SEÑAL de que la providencia lleva cuadro: si el decisor lo borra del texto, no
 * hay tabla. Es la consecuencia coherente de que mande el editor.
 */
export const MARCADOR_CUADRO = "{Cuadro de horas}";

/**
 * Los datos de la prueba que NO viven en el caso de la bandeja, ya resueltos entre sus dos orígenes
 * (Fase 03.15, D-5).
 *
 * Es «lo que el decisor está tecleando ahora mismo» **o** «lo que se leyó del expediente», mezclado
 * por el modal con `mezclarContextoTokens` antes de llegar aquí. Los valores son CADENAS ya
 * formateadas para imprimirse: quien las compone es quien sabe en qué formato las quiere leer un
 * administrado, y este módulo no formatea fechas.
 */
export interface ContextoTokens {
  /** Fecha del pago, tal y como debe salir impresa. */
  pagoAt?: string;
  /** Nº de transacción del comprobante. */
  transaccion?: string;
  // ── Los tres del ESCRITO DE EXCUSA (Quick 260916-kwg, D-03) ────────────────────────────────────
  // Tampoco salen del caso de la bandeja, y por el mismo motivo que los de la prueba: no son datos
  // del expediente, son datos del ACTO que se está redactando ahora mismo.
  /** Título de la causal elegida en el desplegable (`CausalExcusa.titulo`). */
  causal?: string;
  /** Nombre completo del decisor que se excusa (`usuFullName` de la sesión). */
  decisor?: string;
  /** Fecha de presentación, ya formateada en letra (`DatetimeUtil.formatFechaLarga`). */
  fecha?: string;
}

/**
 * Mezcla los DOS orígenes de los datos de la prueba, con la precedencia de D-5.
 *
 * 🔑 **Lo que venga del FORMULARIO manda sobre lo guardado.** No es deferencia al cliente: es que el
 * acto puede emitirse en el mismo momento de redactarlo, y *«el decisor que la acaba de teclear en
 * el modal no puede ver cómo el sistema se la sustituye por la de ayer. Lo guardado rellena el
 * hueco; no lo pisa»* — es la misma decisión, palabra por palabra, que el backend ya tiene escrita
 * para las órdenes de pago (`providencia.service.ts`, `conOrdenesDelExpediente`).
 *
 * ⚠️ Un campo en BLANCO del formulario no es un valor: es el campo que se abrió y se dejó vacío.
 * Tratarlo como valor borraría el dato bueno del expediente, que es el modo de fallo contrario y
 * peor — y además silencioso, porque el token simplemente dejaría de ofrecerse.
 *
 * @param guardado lo que consta en el expediente (origen A)
 * @param tecleado lo que el decisor está escribiendo en el modal (origen B)
 */
export function mezclarContextoTokens(
  guardado: ContextoTokens,
  tecleado: ContextoTokens,
): ContextoTokens {
  const conValor = (b?: string, a?: string) =>
    b?.trim() ? b.trim() : a?.trim() || undefined;

  return {
    pagoAt: conValor(tecleado.pagoAt, guardado.pagoAt),
    transaccion: conValor(tecleado.transaccion, guardado.transaccion),
  };
}

/** Un dato del expediente que se puede insertar en el editor. */
export interface TokenProvidencia {
  /** Marcador que se inserta en el texto. */
  token: string;
  /** Lo que se lee en el badge. */
  etiqueta: string;
  /**
   * Valor real, que se muestra como tooltip para que nadie inserte a ciegas.
   *
   * El `contexto` es OPCIONAL a propósito: sin él, los cuatro tokens de siempre se resuelven
   * exactamente igual que antes de la Fase 03.15, y los llamadores que no tienen prueba que aportar
   * —que son todos los tipos de providencia salvo cuatro— no cambian ni una línea.
   */
  resolver: (
    caso: MiEpasAsignado,
    contexto?: ContextoTokens,
  ) => string | undefined;
}

export const TOKENS_PROVIDENCIA: readonly TokenProvidencia[] = [
  {
    token: "{Expediente}",
    etiqueta: "Expediente",
    resolver: (c) => c.expNumber,
  },
  {
    token: "{Nombre Administrado}",
    etiqueta: "Administrado/a",
    resolver: (c) => c.administrado,
  },
  { token: "{CI/RUC}", etiqueta: "CI/RUC", resolver: (c) => c.cedula },
  // 🔴 {Materia} y {Submateria} salen DEL EXPEDIENTE, y desde la quick 261104-jh1 son las de SORTEO
  // que el servidor resolvió por la submateria de cada infracción («LICENCIAMIENTO» / «LUAE»).
  // Llevan SOLO nombres resueltos: la etiqueta «Sin materia» es un flag de pantalla y nunca se
  // imprime en un documento. Si el EPAS tiene infracciones de
  // varias submaterias, `expSubmateria` llega con todas ya unidas (D-00b) y se imprime tal cual:
  // aquí no se parte ni se recompone nada. Sin infracciones el servidor no manda ninguna de las
  // dos, y el token no se ofrece. El escrito de excusa comparte este registro, así que su «en
  // materia de {Materia}» lee lo mismo.
  { token: "{Materia}", etiqueta: "Materia", resolver: (c) => c.expMateria },
  {
    token: "{Submateria}",
    etiqueta: "Submateria",
    resolver: (c) => c.expSubmateria,
  },
  // ── Los datos de la PRUEBA (Fase 03.15, D-5) ───────────────────────────────────────────────
  // No salen del caso: salen del `contexto`, porque tienen DOS orígenes —el expediente, si el
  // comprobante ya constaba; el formulario del modal, si se aporta en el mismo acto— y el segundo
  // no existe hasta que alguien lo teclea. La precedencia entre ambos la resuelve
  // `mezclarContextoTokens`, que es donde está escrito el porqué.
  {
    token: "{Fecha de pago}",
    etiqueta: "Fecha de pago",
    resolver: (_c, contexto) => contexto?.pagoAt,
  },
  {
    token: "{Transacción}",
    etiqueta: "Nro. de transacción",
    resolver: (_c, contexto) => contexto?.transaccion,
  },
  // ── Los datos del ESCRITO DE EXCUSA (Quick 260916-kwg, D-03) ───────────────────────────────────
  // Viven en ESTE registro, y no en uno propio del escrito, a propósito: un segundo registro sería
  // un segundo mecanismo de tokens, con su propia función de resolución y su propio filtro — dos
  // sitios donde arreglar el mismo defecto el día que aparezca.
  //
  // 🔴 El efecto sobre la PROVIDENCIA es NULO, y no por suerte: los tres resuelven SOLO desde el
  // contexto, y `EmitirProvidenciaModal` no lo pasa, así que `tokensDisponibles` los filtra y su
  // lista de badges no cambia. Hay una prueba que lo clava (`providenciaComposicion.test.ts`).
  //
  // ⚠️ Lo que NO está aquí es `{Detalle}`: es una MARCA DE SITIO, no un dato que se sustituya por su
  // valor — la misma semántica que `MARCADOR_CUADRO`. Meterlo en este registro rompería la regla
  // «sin hecho concreto no hay párrafo SEGUNDO», porque `resolverTokens` lo habría hecho desaparecer
  // antes de que `componerEscritoExcusa` pudiera localizar su párrafo.
  {
    token: "{Causal}",
    etiqueta: "Causal de la excusa",
    resolver: (_c, contexto) => contexto?.causal,
  },
  {
    token: "{Decisor}",
    etiqueta: "Funcionario decisor",
    resolver: (_c, contexto) => contexto?.decisor,
  },
  {
    token: "{Fecha}",
    etiqueta: "Fecha",
    resolver: (_c, contexto) => contexto?.fecha,
  },
] as const;

/**
 * Los tokens que HOY tienen valor para este caso. Un token sin dato no se ofrece: insertarlo dejaría
 * un marcador que nadie resolverá y que acabaría impreso tal cual en un documento legal.
 *
 * 🔴 **Cuidado que no es obvio, y que hay que respetar en el llamador.** Como esta función FILTRA
 * por «tiene valor», y con el origen B el valor aparece **mientras se teclea**, quien la invoque
 * desde un `useMemo` tiene que incluir el `contexto` en sus dependencias. Si no, la lista se
 * calcula una vez con el contexto vacío y los dos tokens de la prueba **no aparecerán nunca** —
 * sin error, sin aviso y sin que nada se ponga rojo.
 */
export function tokensDisponibles(
  caso: MiEpasAsignado,
  contexto?: ContextoTokens,
): TokenProvidencia[] {
  return TOKENS_PROVIDENCIA.filter((t) => {
    const valor = t.resolver(caso, contexto)?.trim();
    return !!valor;
  });
}

/** Resuelve los tokens de un HTML contra el caso. Lo que no tenga valor se deja como está. */
export function resolverTokens(
  html: string,
  caso: MiEpasAsignado,
  contexto?: ContextoTokens,
): string {
  return TOKENS_PROVIDENCIA.reduce((texto, t) => {
    const valor = t.resolver(caso, contexto)?.trim();
    if (!valor) return texto;
    return texto.split(t.token).join(valor);
  }, html);
}

/** ¿Tiene esta sección algo que mandar? Un editor vacío de Tiptap sigue trayendo `<p></p>`. */
export function tieneContenido(html: string | undefined): boolean {
  if (!html) return false;
  const sinEtiquetas = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return sinEtiquetas.length > 0;
}

/** Lo que el decisor escribió, listo para el backend. */
export interface BorradorComposicion {
  cuerpo?: string;
}

/**
 * Arma las secciones del cuerpo de `POST /providencias`.
 *
 * Es UNA sección: el cuerpo entero. Los tokens del expediente se resuelven ANTES de mandar —al
 * backend llega texto, no marcadores— pero el del CUADRO se deja intacto a propósito: no es un dato
 * que se sustituya por su valor, es la marca de sitio que el backend usa para injertar la tabla.
 *
 * Un cuerpo vacío no viaja: sin secciones, el backend imprime la providencia con su cabecera y su
 * cierre, y el modal ya impide llegar aquí sin texto.
 */
export function seccionesParaEnviar(
  borrador: BorradorComposicion,
  caso: MiEpasAsignado,
  contexto?: ContextoTokens,
): Array<{ clave: string; html?: string }> {
  if (!tieneContenido(borrador.cuerpo)) return [];

  return [
    {
      clave: SECCION_CUERPO.clave,
      html: resolverTokens(borrador.cuerpo!, caso, contexto),
    },
  ];
}

/**
 * Cabecera prellenada con lo que el caso SÍ trae. El resto de campos los teclea el decisor en el
 * modal y, cuando llegue Core (Fase 5), dejarán de preguntarse.
 */
export function cabeceraDesdeCaso(
  caso: MiEpasAsignado,
): Record<string, string> {
  const cabecera: Record<string, string> = {};
  if (caso.expNumber) cabecera.expedienteNumero = caso.expNumber;
  if (caso.administrado) cabecera.administradoNombre = caso.administrado;
  if (caso.cedula) cabecera.identificacion = caso.cedula;
  // La materia DEL EXPEDIENTE, deducida por el servidor del código de sus infracciones (D-17).
  if (caso.expMateria) cabecera.materia = caso.expMateria;
  return cabecera;
}

/**
 * ¿Puede este caso recibir una providencia? Es el gate del botón (decisión del usuario, 2026-08-17):
 * el caso tiene que ser SUYO de verdad — aceptado (explícita o implícitamente) y sin excusa
 * pendiente. Es de CONVENIENCIA: el backend manda.
 */
export function puedeEmitirProvidencia(caso: MiEpasAsignado): boolean {
  return caso.aceptado === true && caso.excusaPendiente !== true;
}
