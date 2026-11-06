/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: El término de alegación del art. 10 en pantalla (Fase 03.18, Plan 07)
 * Archivo: TerminoAlegacionPlazo.tsx
 * Responsabilidad: Pintar en qué situación está el término de alegación de un expediente: si ha
 *   arrancado o por qué no, cuánto le queda, cuándo vence, si el administrado ya alegó y si esa
 *   defensa sigue sin contestar.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Adaptado de: instruccion-frontend components/common/PlazosExpediente.tsx (David Caicedo, 2026-08-24)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: el término SUSPENDIDO por la impugnación
 *   se ve como tal —ni vencido ni en curso—, con desde cuándo y los días hábiles que le quedaban; y
 *   lo que una suspensión ya cerrada corrió el vencimiento)
 *
 * ── QUÉ SE ADOPTA Y QUÉ NO ────────────────────────────────────────────────────────────────────
 * Se adopta la PRESENTACIÓN: la función que decide barra, color y etiqueta según la situación del
 * plazo, y el texto «faltan N días hábiles» / «venció» con la unidad dicha en voz alta, porque
 * hábiles no es calendario y quien lee tiene derecho a saber en qué se está contando.
 *
 * 🔴 **NO se adopta su acceso a datos.** El original consulta sus propios plazos por HTTP
 * (`ExpedienteService.plazosExpediente`) dentro de un `useEffect`. Aquí el dato YA VIENE RESUELTO
 * dentro del bloque del correctivo que entregan el detalle y las cuatro bandejas, así que el
 * componente lo recibe por props: volver a pedirlo abriría una segunda lectura que podría discrepar
 * de la que la pantalla ya tiene delante.
 *
 * ── 🔴 ESTE COMPONENTE NO CALCULA DÍAS. LOS RECIBE CONTADOS ───────────────────────────────────
 * Es la misma razón que el original dejó escrita, y aquí vale doble: los días hábiles dependen de
 * los feriados (`t_feriado_ejecucion`) y contarlos aquí daría distinto de la fecha legal del
 * expediente. No hay en este archivo ni una resta de fechas. Lo único que se hace con una fecha es
 * FORMATEARLA para enseñarla, y eso lo hace `DatetimeUtil`, fuera de aquí.
 *
 * Y la frase del módulo, que es la razón de que este componente exista y no viva sólo en el detalle:
 * *«si el plazo no se ve, el administrado pierde el derecho porque nadie miró el calendario, no
 * porque no lo pidiera»*.
 */

import type { FC } from "react";
import Alert from "./Alert";
import type {
  EstadoTermino,
  TerminoAlegacion,
} from "../../interfaces/IObligacionHacer";
import { DatetimeUtil } from "../../utils/datetime.util";

type TerminoAlegacionPlazoProps = {
  /** El término tal y como lo derivó el servidor. Ninguno de sus campos es una columna. */
  termino: TerminoAlegacion;
  /**
   * `compacto` muestra la franja de una línea, para cabeceras donde el término es CONTEXTO y no el
   * contenido principal. Sin él se muestra el bloque completo con la alegación y sus avisos.
   */
  compacto?: boolean;
};

/** Cómo se ve el término según su situación: color de la barra, del texto y etiqueta. */
const presentacion = (
  termino: TerminoAlegacion,
): { barra: string; texto: string; etiqueta: string } => {
  // quick 261028-mtg: el término DETENIDO por la impugnación. Ni corre ni vence: pintarlo como «en
  // curso» haría creer que se consume, y como «vencido» que ya habilita la multa.
  if (termino.estado === "SUSPENDIDO") {
    return {
      barra: "bg-warning/50",
      texto: "text-warning",
      etiqueta: "Suspendido",
    };
  }
  if (termino.estado === "VENCIDO" || termino.vencido) {
    return { barra: "bg-error/60", texto: "text-error", etiqueta: "Vencido" };
  }
  if (termino.estado === "EN_CURSO") {
    const restantes = termino.diasHabilesRestantes;
    if (restantes !== null && restantes <= 3) {
      return {
        barra: "bg-warning",
        texto: "text-warning",
        etiqueta: "Por vencer",
      };
    }
    return { barra: "bg-primary", texto: "text-primary", etiqueta: "En curso" };
  }
  // SIN_TRASLADO y SIN_NOTIFICAR: el término NO ha arrancado. No es un plazo corriendo ni uno
  // vencido, y pintarlo de cualquiera de los dos colores afirmaría algo que no ha pasado.
  return {
    barra: "bg-base-300",
    texto: "text-base-content/60",
    etiqueta: "Sin arrancar",
  };
};

/** Cómo se lee cada situación en una línea. El enum no se enseña crudo a nadie. */
const ETIQUETA_ESTADO: Record<EstadoTermino, string> = {
  SIN_TRASLADO: "Todavía no se ha corrido traslado del informe",
  SIN_NOTIFICAR: "El traslado se emitió, pero su notificación no está cerrada",
  EN_CURSO: "El término de alegación está corriendo",
  VENCIDO: "El término de alegación ya venció",
  SUSPENDIDO:
    "El término de alegación está suspendido por la impugnación: no corre hasta que la Procuraduría resuelva el recurso",
};

/**
 * «faltan 4 días hábiles» / «vence hoy» / «el término venció».
 *
 * 🔴 CON EL TÉRMINO VENCIDO NO SE PINTA NINGÚN NÚMERO. El servidor manda `diasHabilesRestantes` en
 * nulo justamente entonces, y un «faltan -3 días» sería una resta que aquí no se puede hacer bien:
 * sin el calendario de feriados delante, el número saldría distinto del que sostiene el expediente.
 */
const textoRestante = (termino: TerminoAlegacion): string => {
  // quick 261028-mtg: los días que QUEDABAN al suspenderse, contados por el servidor. No «faltan»:
  // mientras dure la suspensión no se consumen.
  if (termino.estado === "SUSPENDIDO") {
    const desde = termino.suspendidoDesde
      ? `suspendido desde el ${DatetimeUtil.formatDate(termino.suspendidoDesde)}`
      : "suspendido por la impugnación";
    const restantes = termino.diasHabilesRestantes;
    if (restantes === null) return desde;
    return `${desde}; le quedaban ${restantes} ${
      restantes === 1 ? "día hábil" : "días hábiles"
    }`;
  }
  if (termino.estado === "VENCIDO" || termino.vencido) {
    return "el término venció";
  }
  if (termino.estado !== "EN_CURSO") {
    return "el término no ha arrancado";
  }
  const restantes = termino.diasHabilesRestantes;
  if (restantes === null) {
    return "sin días contados por el servidor";
  }
  if (restantes === 0) {
    return "vence hoy";
  }
  return `faltan ${restantes} ${restantes === 1 ? "día hábil" : "días hábiles"}`;
};

/**
 * El AÑO de una cadena ISO, leído como TEXTO.
 *
 * 🔴 Es una lectura de los cuatro primeros caracteres, NO una conversión a fecha: convertirla
 * aplicaría la zona horaria del navegador y podría devolver el año anterior para un vencimiento del
 * 1 de enero. Aquí sólo hace falta el año que la propia cadena declara.
 */
const anioDe = (iso: string | null): number | null => {
  if (!iso || iso.length < 4) return null;
  const anio = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isNaN(anio) ? null : anio;
};

/**
 * ¿Hay que advertir de que el calendario de feriados no alcanza?
 *
 * Dos casos, y los dos importan: el calendario VACÍO (nace así, hasta que el administrador cargue el
 * año) y el calendario que se queda CORTO respecto del vencimiento. En ambos, la cuenta de hábiles
 * se comportó como si sólo hubiera fines de semana, y el término informado puede estar ACORTADO.
 * Callarlo sería contar sin feriados en silencio.
 */
const avisoDeCalendario = (termino: TerminoAlegacion): string | null => {
  if (termino.calendarioCargadoHasta === null) {
    return (
      "El calendario de feriados está VACÍO: los días hábiles se contaron descontando sólo " +
      "sábados y domingos. El término informado puede estar acortado; cargue el calendario del año."
    );
  }
  const anioVence = anioDe(termino.venceAt);
  if (anioVence !== null && anioVence > termino.calendarioCargadoHasta) {
    return (
      `El calendario de feriados sólo está cargado hasta ${termino.calendarioCargadoHasta} y este ` +
      `término vence en ${anioVence}: los feriados de ese año no se descontaron. El vencimiento ` +
      "informado puede estar acortado."
    );
  }
  return null;
};

/**
 * Cuánto se ha recorrido del término, para la barra.
 *
 * ⚠️ Sale de los DOS NÚMEROS QUE EL SERVIDOR YA CONTÓ —el plazo total y los hábiles restantes—, no
 * de un reloj ni de una diferencia entre fechas. Es una proporción entre dos cantidades dadas; si
 * faltara cualquiera de las dos, la barra se queda en su extremo en vez de inventarse una posición.
 */
const porcentajeTranscurrido = (termino: TerminoAlegacion): number => {
  if (termino.plazoDias !== null && termino.plazoDias > 0) {
    const consumidos = termino.plazoDias - (termino.diasHabilesRestantes ?? 0);
    const bruto = Math.round((consumidos * 100) / termino.plazoDias);
    return Math.min(100, Math.max(0, bruto));
  }
  return termino.vencido || termino.estado === "VENCIDO" ? 100 : 0;
};

const TerminoAlegacionPlazo: FC<TerminoAlegacionPlazoProps> = ({
  termino,
  compacto = false,
}) => {
  const estilo = presentacion(termino);
  const aviso = avisoDeCalendario(termino);
  const porcentaje = porcentajeTranscurrido(termino);

  const franja = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
          Término para alegar
        </p>
        <p className="text-sm font-medium">{estilo.etiqueta}</p>
      </div>

      <div className="min-w-[10rem] flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className={`font-medium ${estilo.texto}`}>
            {textoRestante(termino)}
          </span>
          {termino.venceAt && (
            <span className="text-base-content/50 tabular-nums">
              vence el {DatetimeUtil.formatDate(termino.venceAt)}
            </span>
          )}
        </div>
        {/* Barra propia en vez de <progress>, igual que el original: permite atenuar el término que
            no ha arrancado en vez de pintarlo como uno al 0 % que sí estuviera corriendo. */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-base-300"
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Término para alegar: ${porcentaje}% transcurrido`}
        >
          <div
            className={`h-full rounded-full transition-all ${estilo.barra}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>
    </div>
  );

  if (compacto) {
    return (
      <div className="flex flex-col gap-1">
        {franja}
        {/* Hasta en la franja de cabecera: el arranque por agotamiento y el calendario corto son las
            dos cosas que NO se pueden dejar para la pantalla grande. */}
        {termino.arrancoPorAgotamiento && (
          <p className="text-xs text-warning">
            El término arrancó porque se agotaron los intentos de notificación.
          </p>
        )}
        {aviso && <p className="text-xs text-warning">{aviso}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {franja}

      <p className="text-sm text-base-content/70">
        {ETIQUETA_ESTADO[termino.estado]}.
      </p>

      {/* EL MOTIVO. Sólo viene en SIN_TRASLADO y SIN_NOTIFICAR, y es lo que separa «todavía no hay
          nada que arrancar» de «falta declarar las formas de notificación del administrado», que es
          un hueco de DATOS corregible. Colapsarlos escondería justo el que se puede corregir. */}
      {termino.motivo && (
        <p className="rounded-lg border border-dashed border-base-300 px-4 py-3 text-sm text-base-content/80">
          {termino.motivo}
        </p>
      )}

      {/* 🔴 SE DECLARA. El término corre igual —así evita que un administrado ilocalizable congele
          el expediente—, pero dar por arrancado un plazo de defensa contra quien no se pudo
          notificar y NO DECIRLO es otra cosa. */}
      {termino.arrancoPorAgotamiento && (
        <Alert
          variant="warning"
          message="El término arrancó porque se AGOTARON los intentos de notificación, no porque el administrado la recibiera."
        />
      )}

      {aviso && <Alert variant="warning" message={aviso} />}

      {/* quick 261028-mtg: una impugnación YA RESUELTA corrió el vencimiento. El servidor ya lo
          sumó a `venceAt`; aquí solo se dice, para que la fecha no parezca un error. */}
      {(termino.diasHabilesSuspendidos ?? 0) > 0 && (
        <p className="text-sm text-base-content/70">
          El vencimiento se corrió {termino.diasHabilesSuspendidos}{" "}
          {termino.diasHabilesSuspendidos === 1 ? "día hábil" : "días hábiles"}{" "}
          por la impugnación.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-base-content/60">Traslado emitido:</dt>
          <dd>
            {termino.trasladoEmitidoAt
              ? DatetimeUtil.formatDate(termino.trasladoEmitidoAt)
              : "no consta"}
          </dd>
        </div>
        <div className="flex gap-2">
          {/* 🔴 DE DONDE ARRANCA EL RELOJ: la notificación CERRADA, no el despacho. El plazo de
              defensa empieza cuando hay defensa posible. */}
          <dt className="text-base-content/60">El término arranca el:</dt>
          <dd>
            {termino.arrancaAt
              ? DatetimeUtil.formatDate(termino.arrancaAt)
              : "todavía no arranca"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-base-content/60">Plazo:</dt>
          <dd>
            {termino.plazoDias === null
              ? "sin plazo corriendo"
              : `${termino.plazoDias} días hábiles`}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-base-content/60">Vence el:</dt>
          <dd>
            {termino.venceAt
              ? DatetimeUtil.formatDate(termino.venceAt)
              : "sin vencimiento"}
          </dd>
        </div>
      </dl>

      {/* LA ALEGACIÓN. Ninguno de estos campos es una columna: los deriva el servidor del escrito y
          de la providencia que lo resuelve. */}
      <div className="rounded-lg border border-base-200 px-4 py-3 text-sm">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
          La alegación del administrado
        </p>
        {termino.alegacionDocId === null ? (
          <p className="text-base-content/70">
            No consta escrito de alegación en este término.
          </p>
        ) : (
          <>
            <p>
              Escrito ingresado el{" "}
              {DatetimeUtil.formatDate(termino.alegacionIngresadaAt)}
              {termino.terminoUsado ? " (el término se usó)." : "."}
            </p>
            {termino.alegacionResueltaAt ? (
              <p className="text-base-content/70">
                Resuelta el{" "}
                {DatetimeUtil.formatDate(termino.alegacionResueltaAt)}.
              </p>
            ) : (
              <p className="text-warning">
                Sin resolver: hay una defensa pendiente de contestar.
              </p>
            )}
          </>
        )}
        {/* 🔴 LA PROVIDENCIA QUE RESUELVE LA ALEGACIÓN NO SALE DE AQUÍ. Se emite por el camino
            genérico de providencias que el módulo ya tiene, con su tipo propio; esta pantalla sólo
            informa de que falta. */}
        {termino.alegacionPendiente && (
          <p className="mt-2 text-xs text-base-content/60">
            Se resuelve emitiendo la providencia de resolución de la alegación por el camino
            habitual de providencias del expediente.
          </p>
        )}
      </div>

      {/* 🔴 HABILITA; NO DISPARA. No hay job y nadie emite nada por su cuenta: esto sólo le dice al
          decisor que el plazo de defensa se cumplió y que ya PUEDE imponer la multa del art. 240. */}
      {termino.habilitaMultaCompulsoria && (
        <p className="text-sm text-base-content/70">
          El término cumplido HABILITA la multa compulsoria del art. 240. No la dispara: la impone el
          decisor.
        </p>
      )}
    </div>
  );
};

export default TerminoAlegacionPlazo;
