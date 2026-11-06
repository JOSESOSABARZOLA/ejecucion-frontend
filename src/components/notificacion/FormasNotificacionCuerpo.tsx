/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/notificacion (frontend)
 * Feature: La notificación al administrado (Fase 03.14.3) — el cuerpo, montable en dos superficies
 * Archivo: FormasNotificacionCuerpo.tsx
 * Responsabilidad: Declarar POR DÓNDE se puede notificar al administrado, y a qué correo, sin saber
 *   en qué superficie vive.
 *
 *   ── POR QUÉ SE EXTRAJO ───────────────────────────────────────────────────────────────────────
 *   Este cuerpo es lo único que el módulo tiene para declarar las formas aceptadas, y desde la Fase
 *   03.19 hace falta en DOS sitios: el modal del SECRETARIO (Bandeja de Recepción) y el paso 3 de la
 *   página de generación del DECISOR. Se aplica el mismo movimiento que el plan 12 hizo con el
 *   compositor de providencias: se extrae el CUERPO y la cáscara conserva su firma pública.
 *
 *   ── LA ÚNICA DIFERENCIA ENTRE LOS DOS USOS: `renderPie` ──────────────────────────────────────
 *   · CON `renderPie` (el modal) — el cuerpo GUARDA por sí mismo. Entrega `guardar()` a quien pinta
 *     el pie y esa función hace el `PUT /notificacion/formas/:eejeId`.
 *   · SIN `renderPie` (el paso 3) — el cuerpo solo LEVANTA la selección por `onSeleccion`, y quien
 *     monta decide cuándo persistirla. En la página de generación eso ocurre al confirmar la
 *     emisión, ANTES de emitir, y lo orquesta la propia página.
 *
 *   El pie se pinta como función y no como nodo por el mismo motivo que en el plan 12: quien lo
 *   dibuja necesita el estado interno del cuerpo (si está cargando, si está guardando, si la lectura
 *   fue bien, si no hay ninguna forma marcada) y ese estado no sale de aquí de ninguna otra forma.
 *
 *   ── 🔴 NADA SALE DE AQUÍ ANTES DE QUE LA LECTURA VAYA BIEN ───────────────────────────────────
 *   El `PUT` de formas REEMPLAZA, no parchea. Y las tres casillas nacen en `false`. Juntando las
 *   dos cosas, publicar o escribir la selección antes de haber leído equivale a declarar que el
 *   administrado no acepta ninguna forma: el expediente se queda sin despachos, nadie queda
 *   notificado y ningún plazo empieza a correr, sin que nadie vea un error. Por eso `onSeleccion`
 *   calla hasta que la lectura termina bien y `guardar()` se niega mientras no lo haya hecho.
 *
 *   ── VARIAS DIRECCIONES, NO UNA ───────────────────────────────────────────────────────────────
 *   El administrado puede tener más de un correo, y se despacha a TODAS las vigentes: una por cada
 *   dirección, con su propio resultado y su propia razón. Cada una dice de dónde salió, porque eso
 *   es lo que hay que poder responder cuando alguien alega que nunca le llegó.
 *
 *   Y no se borran: se marcan como NO vigentes, y así se enseñan —atenuadas y etiquetadas, nunca
 *   ausentes—. Las notificaciones que ya salieron ahí tienen que seguir apuntando a algo, y una
 *   lista que las esconde deja sin respuesta a quien pregunte por una notificación vieja.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 * Modificado por: Andrés Miño — 2026-10-21 (Fase 03.24, cierre de huecos G-05: sin dirección —NULL
 *   desde la migración del 2026-10-20— el campo enseña `PISTA_SIN_DIRECCION` asociada por
 *   `aria-describedby`, y «Antes:» cae en `ANTES_SIN_DIRECCION`. La regla D-15 sigue en el servidor;
 *   desde el quick 261026-ft2 el cuerpo también la DICE en línea, pero quien decide sigue siendo él).
 * Modificado por: Andrés Miño — 2026-10-26 (quick 261026-ft2: un canal MARCADO sin su dato —correo sin
 *   dirección vigente, casillero sin número, físico sin dirección— se dice en línea bajo ese canal con
 *   la frase del servidor (`motivosFormasIncompletas`), con `aria-invalid` y `aria-describedby` en la
 *   casilla y en su campo; y el primer motivo sube por `onMotivoFormasIncompletas`, un canal APARTE de
 *   la selección, que es el cuerpo exacto del `PUT`. El modal guarda como siempre).
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al leer las formas se queda
 *   en línea; los de añadir, desactivar y guardar —y la negativa a guardar sin leer— van al aviso
 *   flotante)
 */

import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Alert from "../common/Alert";
import { useToast } from "../../hooks/useToast";
import Boton from "../common/Boton";
import Loading from "../common/Loading";
import {
  NotificacionEjecucionService,
  PROCEDENCIAS,
  type FormasAceptadas,
} from "../../services/NotificacionEjecucionService";
import {
  motivosFormasIncompletas,
  primerMotivoFormas,
  type MotivosFormasIncompletas,
} from "../../utils/formasNotificacion.util";

/**
 * Lo que el usuario marcó. Es exactamente el cuerpo del `PUT /notificacion/formas/:eejeId`, para que
 * quien lo persista después no tenga que traducir nada.
 */
export interface SeleccionFormas {
  aceptaCorreo: boolean;
  aceptaCasillero: boolean;
  aceptaFisico: boolean;
  /** Recortado; `undefined` si quedó en blanco. Omitirlo lo deja como está. */
  casillero?: string;
  /** Recortado; `undefined` si quedó en blanco. Omitirlo lo deja como está. */
  direccion?: string;
}

/** Lo que el cuerpo entrega a quien pinta el pie. Canal de solo lectura salvo `guardar`. */
export interface AccionesFormas {
  /**
   * Persiste la selección. Devuelve `true` si el servidor la aceptó; con `false` el cuerpo ya pintó
   * el error del servidor —que dice QUÉ dato falta para el canal marcado— y la cáscara no cierra.
   */
  guardar: () => Promise<boolean>;
  /** Hay una escritura en vuelo (guardar, añadir correo o desactivar correo). */
  guardando: boolean;
  /** Todavía no se leyeron las formas del expediente. */
  cargando: boolean;
  /**
   * La lectura de las formas TERMINÓ BIEN. Con `false` lo que se ve en pantalla no es lo que hay en
   * el expediente —son los valores iniciales de las casillas—, así que escribirlo lo BORRARÍA.
   * Quien pinte el pie tiene que apagar su botón de guardar mientras esto sea `false`.
   */
  leido: boolean;
  /** No hay ninguna forma marcada. */
  ninguna: boolean;
}

/**
 * 🔴 EL MOTIVO QUE IMPIDE ESCRIBIR CUANDO LA LECTURA FALLÓ.
 *
 * Las tres casillas nacen en `false`. Mientras la lectura no haya ido bien, esos tres «no» no son
 * una declaración de nadie: son el estado inicial del componente. Escribirlos sería un reemplazo
 * COMPLETO de lo que el secretario declaró (`PUT /notificacion/formas/:eejeId` no parchea, sustituye),
 * y el expediente se quedaría sin ninguna forma aceptada: las providencias que se emitan después
 * saldrían sin despachos, nadie quedaría notificado y ningún plazo empezaría a correr — y eso no se
 * descubre hasta que el plazo que debía correr no corrió (T-03.19-70).
 *
 * Va en minúscula inicial a propósito: la página de generación lo incrusta como MOTIVO dentro del
 * sobre de error de UI-SPEC §5.8, y una mayúscula en mitad de esa frase se leería como una errata.
 */
export const MOTIVO_FORMAS_NO_LEIDAS =
  "no se pudieron leer las formas de notificación del expediente, y guardarlas ahora las borraría todas";

/**
 * Lo que el propio cuerpo pinta si alguien intenta guardar sin haber leído. Es la misma razón que
 * `MOTIVO_FORMAS_NO_LEIDAS`, dicha como frase suelta porque aquí no se incrusta en ninguna otra.
 */
const AVISO_GUARDAR_SIN_LEER =
  "No se pudieron leer las formas de notificación de este expediente. Guardar ahora las borraría todas: cierre y vuelva a abrir esta pantalla cuando se puedan leer.";

/**
 * El aviso por defecto cuando no hay ninguna forma marcada. Es el texto que el modal del secretario
 * lleva desde la Fase 03.14.3 y se conserva palabra por palabra: cambiarlo aquí cambiaría una
 * pantalla que este plan no viene a tocar. El paso 3 pasa el suyo (UI-SPEC §5.5).
 */
export const AVISO_SIN_FORMAS_POR_DEFECTO =
  "Sin ninguna forma aceptada, las providencias se emiten pero NO se despachan: nadie queda notificado y ningún plazo empieza a correr.";

/**
 * 🔴 G-05 (UI-SPEC §5 y §6.5) — lo que se enseña bajo el campo cuando el servidor no manda dirección
 * y el campo está vacío. Desde la Fase 03.24 todo EPAS de Resolución llega así. La pantalla explica
 * el vacío y nada más: no bloquea «Físico (domicilio)», porque la regla D-15 es del servidor y su
 * mensaje sale en el `Alert` de error que ya existe.
 */
export const PISTA_SIN_DIRECCION =
  "Sin dirección registrada. Escríbala si el administrado acepta la notificación en su domicilio.";

/** El respaldo de la línea «Antes:» cuando lo leído no traía dirección (UI-SPEC §6.5). */
export const ANTES_SIN_DIRECCION = "sin dirección registrada";

export interface PropsFormasNotificacionCuerpo {
  /** Expediente del que se leen y sobre el que se escriben las formas. */
  eejeId?: number;
  /** Apaga todos los controles: quien monta tiene un envío en vuelo. */
  deshabilitado?: boolean;
  /** Se llama con lo leído del servidor. Sirve para el encabezado de la cáscara (el nombre). */
  onDatos?: (formas: FormasAceptadas) => void;
  /**
   * Se llama con la selección vigente: tras una lectura CON ÉXITO y en cada cambio posterior.
   * Memorizar la función.
   *
   * 🔴 Si la lectura falla NO se llama NUNCA. Quien monta se queda sin selección, y eso es la
   * señal —la única— de que lo que se ve en pantalla no es lo que hay en el expediente.
   */
  onSeleccion?: (seleccion: SeleccionFormas) => void;
  /**
   * Se llama con el PRIMER motivo por el que un canal marcado no se podría guardar (regla D-15 del
   * servidor, en su orden: correo, casillero, físico), tras una lectura CON ÉXITO y en cada cambio
   * posterior. `undefined` = se puede avanzar: ninguna marcada o todas con su dato. Es una cadena y
   * no un objeto para que quien monta no repinte de más. Memorizar la función.
   *
   * Va APARTE de `onSeleccion` porque la selección es el cuerpo exacto del `PUT` (que rechaza
   * campos de más) y la validez no es parte de ella. Si la lectura falla NO se llama nunca: misma
   * regla de silencio que `onSeleccion`, y la página ya se niega a emitir por esa otra vía.
   */
  onMotivoFormasIncompletas?: (motivo: string | undefined) => void;
  /** Texto del aviso persistente cuando no hay ninguna forma marcada. */
  mensajeSinFormas?: string;
  /**
   * Canal de SOLO LECTURA con el estado interno del cuerpo. Lo consume quien pinta algo FUERA del
   * cuerpo que dependa de él —el aspa del diálogo, que se apaga mientras hay escritura en vuelo—.
   * Viaja por un efecto, no por el render, para no actualizar un componente mientras se pinta otro.
   */
  onEstado?: (estado: { cargando: boolean; guardando: boolean }) => void;
  /** Si se pasa, el cuerpo pinta este pie y guarda por sí mismo. Si no, solo levanta la selección. */
  renderPie?: (acciones: AccionesFormas) => ReactNode;
}

const FormasNotificacionCuerpo = ({
  eejeId,
  deshabilitado = false,
  onDatos,
  onSeleccion,
  onMotivoFormasIncompletas,
  mensajeSinFormas = AVISO_SIN_FORMAS_POR_DEFECTO,
  onEstado,
  renderPie,
}: PropsFormasNotificacionCuerpo) => {
  const { addToast } = useToast();
  const [formas, setFormas] = useState<FormasAceptadas | null>(null);
  const [cargando, setCargando] = useState(true);
  /**
   * La lectura terminó BIEN. No se deduce de `cargando`: «ya no se está leyendo» es verdad también
   * cuando la lectura reventó, y confundir las dos es justamente lo que dejaba escribir tres «no»
   * que nadie declaró.
   */
  const [leido, setLeido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [casillero, setCasillero] = useState("");
  /** Domicilio de notificación: llega con el EPAS y se puede corregir (mudanza, erratas). */
  const [direccion, setDireccion] = useState("");
  const [correoNuevo, setCorreoNuevo] = useState("");
  const [procedencia, setProcedencia] = useState<string>(PROCEDENCIAS[0].valor);
  const [aceptaCorreo, setAceptaCorreo] = useState(false);
  const [aceptaCasillero, setAceptaCasillero] = useState(false);
  const [aceptaFisico, setAceptaFisico] = useState(false);
  /**
   * Fallo al LEER las formas: se dice en línea, en su hueco (regla 3b de 261028-kmg). Los fallos de
   * añadir, desactivar y guardar —y la negativa a guardar sin haber leído— van al aviso flotante.
   */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  /**
   * Los dos avisos hacia arriba viajan por un `ref` y no por las dependencias del efecto: si quien
   * monta pasa una función nueva en cada render —lo normal si se escribe en línea—, meterla en las
   * dependencias dispararía el efecto sin parar. Es la misma cautela que el compositor del plan 12
   * documenta para su canal de estado.
   */
  const onDatosRef = useRef(onDatos);
  const onSeleccionRef = useRef(onSeleccion);
  const onEstadoRef = useRef(onEstado);
  const onMotivoRef = useRef(onMotivoFormasIncompletas);
  useEffect(() => {
    onDatosRef.current = onDatos;
    onSeleccionRef.current = onSeleccion;
    onEstadoRef.current = onEstado;
    onMotivoRef.current = onMotivoFormasIncompletas;
  });

  /** Ids del motivo en línea de cada canal: los enlaza `aria-describedby`. */
  const idMotivoCorreo = useId();
  const idMotivoCasillero = useId();
  const idMotivoFisico = useId();

  useEffect(() => {
    let vivo = true;
    // Al cambiar de expediente lo leído deja de valer: hasta que la lectura NUEVA no termine bien,
    // lo que hay en las casillas no describe a este expediente y no se puede ni publicar ni escribir.
    setLeido(false);
    void (async () => {
      try {
        const datos = await NotificacionEjecucionService.formas(eejeId ?? 0);
        if (!vivo) return;
        setFormas(datos);
        setCasillero(datos.casillero ?? "");
        setDireccion(datos.direccion ?? "");
        setAceptaCorreo(datos.aceptaCorreo);
        setAceptaCasillero(datos.aceptaCasillero);
        setAceptaFisico(datos.aceptaFisico);
        setLeido(true);
        onDatosRef.current?.(datos);
      } catch (err) {
        if (vivo)
          setErrorCarga(
            mensajeParaUsuario(err, "No se pudieron leer las formas de notificación."),
          );
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [eejeId]);

  /**
   * 🔴 LA SELECCIÓN SOLO SE LEVANTA DESPUÉS DE UNA LECTURA CON ÉXITO.
   *
   * Antes se levantaba SIEMPRE, y por eso este efecto corría al montar —con las tres casillas en su
   * `false` inicial— antes de que la lectura resolviera. Quien montaba recibía así una selección que
   * nadie había hecho y no podía distinguirla de una declaración real: un objeto con tres «no» es
   * tan verdadero como uno con tres «sí». Si además la lectura fallaba, esa selección fantasma se
   * quedaba puesta y la página de generación la escribía al emitir, BORRANDO las formas que el
   * secretario había declarado. El único aviso era la caja de error de este cuerpo, que en el paso 3
   * está oculta mientras el decisor confirma desde el paso 4.
   *
   * Callar hasta que la lectura vaya bien convierte esa ambigüedad en una señal: sin llamada, quien
   * monta SABE que no hay nada declarado y puede negarse a escribir.
   */
  useEffect(() => {
    if (!leido) return;
    onSeleccionRef.current?.({
      aceptaCorreo,
      aceptaCasillero,
      aceptaFisico,
      casillero: casillero.trim() || undefined,
      direccion: direccion.trim() || undefined,
    });
  }, [
    leido,
    aceptaCorreo,
    aceptaCasillero,
    aceptaFisico,
    casillero,
    direccion,
  ]);

  useEffect(() => {
    onEstadoRef.current?.({ cargando, guardando });
  }, [cargando, guardando]);

  /**
   * LA REGLA D-15 DEL SERVIDOR, DICHA AQUÍ (quick 261026-ft2). Solo con lo LEÍDO: antes de leer no se
   * sabe qué correos hay ni qué casillero o dirección guarda el expediente, y afirmar que falta algo
   * sería inventarse el dato — la misma cautela que el aviso de «ninguna». Se calcula con el estado
   * CRUDO de los campos: la regla recorta y cae al valor guardado como `guardarFormas`.
   */
  const motivos: MotivosFormasIncompletas =
    leido && formas !== null
      ? motivosFormasIncompletas(
          { aceptaCorreo, aceptaCasillero, aceptaFisico, casillero, direccion },
          formas,
        )
      : {};
  const primerMotivo = primerMotivoFormas(motivos);

  useEffect(() => {
    if (!leido) return;
    onMotivoRef.current?.(primerMotivo);
  }, [leido, primerMotivo]);

  // `!leido` apaga los controles además de impedir el guardado: con la lectura rota, marcar una
  // casilla dejaría al usuario creyendo que declaró algo que no se va a escribir en ningún sitio.
  const ocupado = guardando || deshabilitado || !leido;
  const ninguna = !aceptaCorreo && !aceptaCasillero && !aceptaFisico;
  const vigentes = formas?.correos.filter((c) => c.vigente) ?? [];
  // G-05: solo con lo LEÍDO y sin dirección, y mientras el campo siga vacío. La cadena «null» no
  // es un vacío especial (UI-SPEC §5): si llegara, es un dato malo que tiene que verse.
  const mostrarPistaSinDireccion =
    formas !== null && !formas.direccion?.trim() && direccion.trim() === "";
  // La descripción del campo de dirección une la pista G-05 y el motivo D-15; sin ninguno, nada.
  const describeDireccion =
    [
      mostrarPistaSinDireccion ? "pista-direccion" : null,
      motivos.fisico ? idMotivoFisico : null,
    ]
      .filter((id): id is string => id !== null)
      .join(" ") || undefined;

  const agregarCorreo = async () => {
    if (eejeId == null || !correoNuevo.trim()) return;
    setGuardando(true);
    try {
      const datos = await NotificacionEjecucionService.agregarCorreo(
        eejeId,
        correoNuevo.trim(),
        procedencia,
      );
      setFormas(datos);
      setCorreoNuevo("");
    } catch (err) {
      addToast("error", mensajeParaUsuario(err, "No se pudo añadir el correo."));
    } finally {
      setGuardando(false);
    }
  };

  const desactivarCorreo = async (corrId: number) => {
    if (eejeId == null) return;
    setGuardando(true);
    try {
      setFormas(
        await NotificacionEjecucionService.desactivarCorreo(eejeId, corrId),
      );
    } catch (err) {
      addToast("error", mensajeParaUsuario(err, "No se pudo desactivar."));
    } finally {
      setGuardando(false);
    }
  };

  const guardar = async (): Promise<boolean> => {
    if (eejeId == null) return false;
    // 🔴 LA NEGATIVA VIVE AQUÍ, NO EN EL PIE. El pie lo pinta quien monta, y un pie futuro que
    // olvidara mirar `leido` volvería a abrir el agujero. Con la negativa dentro, ninguna cáscara
    // puede escribir un reemplazo completo con datos que nunca se leyeron.
    if (!leido) {
      addToast("error", AVISO_GUARDAR_SIN_LEER);
      return false;
    }
    setGuardando(true);
    try {
      await NotificacionEjecucionService.guardarFormas(eejeId, {
        aceptaCorreo,
        aceptaCasillero,
        aceptaFisico,
        casillero: casillero.trim() || undefined,
        direccion: direccion.trim() || undefined,
      });
      return true;
    } catch (err) {
      // El error del backend se muestra tal cual, en el aviso flotante: dice QUÉ dato falta para el
      // canal marcado.
      addToast("error", mensajeParaUsuario(err, "No se pudo guardar."));
      return false;
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      {errorCarga && <Alert variant="error" message={errorCarga} />}
      {cargando && <Loading />}

      {!cargando && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm opacity-70">
            Marque <strong>las que el administrado aceptó</strong>: pueden ser
            una, dos o las tres. De cada una se abrirá un despacho en las
            providencias que se emitan a partir de ahora.
          </p>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-1"
              checked={aceptaCorreo}
              disabled={ocupado}
              aria-invalid={motivos.correo ? true : undefined}
              aria-describedby={motivos.correo ? idMotivoCorreo : undefined}
              onChange={(e) => setAceptaCorreo(e.target.checked)}
            />
            <span className="flex-1">
              <span className="font-medium">
                Correo electrónico
                {vigentes.length > 0 && (
                  <span className="ml-2 text-sm opacity-70">
                    se despachará a {vigentes.length}{" "}
                    {vigentes.length === 1 ? "dirección" : "direcciones"}
                  </span>
                )}
              </span>

              <span className="mt-2 flex flex-col gap-1">
                {formas?.correos.map((c) => (
                  <span
                    key={c.corrId}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className={c.vigente ? "" : "line-through opacity-60"}>
                      {c.email}
                    </span>
                    <span className="badge badge-ghost badge-sm">
                      {PROCEDENCIAS.find((p) => p.valor === c.procedencia)
                        ?.etiqueta ?? c.procedencia}
                    </span>
                    {c.vigente ? (
                      <button
                        type="button"
                        className="link link-error text-xs"
                        disabled={ocupado}
                        onClick={() => void desactivarCorreo(c.corrId)}
                      >
                        Ya no es suya
                      </button>
                    ) : (
                      <span className="badge badge-outline badge-sm">
                        No vigente
                      </span>
                    )}
                  </span>
                ))}
                {formas?.correos.length === 0 && (
                  <span className="text-sm opacity-70">
                    Sin direcciones registradas.
                  </span>
                )}
              </span>

              {/* Añadir. La procedencia va junto al correo y no aparte: se declaran a la vez
                  porque después nadie recuerda de dónde salió una dirección. */}
              <span className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  type="email"
                  className="input input-bordered input-sm flex-1"
                  placeholder="Añadir otra dirección"
                  aria-label="Añadir otra dirección"
                  value={correoNuevo}
                  disabled={ocupado}
                  onChange={(e) => setCorreoNuevo(e.target.value)}
                />
                <select
                  className="select select-bordered select-sm"
                  aria-label="Procedencia de la dirección"
                  value={procedencia}
                  disabled={ocupado}
                  onChange={(e) => setProcedencia(e.target.value)}
                >
                  {PROCEDENCIAS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
                <Boton
                  estilos="btn btn-sm btn-outline"
                  texto="Añadir"
                  deshabilitado={ocupado || !correoNuevo.trim()}
                  onClick={() => void agregarCorreo()}
                />
              </span>

              {/* Sin `role`: el pie de la página ya lo anuncia con role=status; aquí basta la
                  asociación con la casilla. */}
              {motivos.correo && (
                <span
                  id={idMotivoCorreo}
                  className="mt-1 block text-xs text-error"
                >
                  {motivos.correo}
                </span>
              )}

              <span className="mt-1 block text-sm opacity-70">
                Las direcciones no se borran: se marcan como no vigentes, porque
                las notificaciones que ya salieron ahí tienen que seguir
                apuntando a algo.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-1"
              checked={aceptaCasillero}
              disabled={ocupado}
              aria-invalid={motivos.casillero ? true : undefined}
              aria-describedby={
                motivos.casillero ? idMotivoCasillero : undefined
              }
              onChange={(e) => setAceptaCasillero(e.target.checked)}
            />
            <span className="flex-1">
              <span className="font-medium">Casillero judicial</span>
              <input
                className="input input-bordered input-sm mt-1 w-full"
                placeholder="Número de casillero"
                aria-label="Número de casillero"
                aria-invalid={motivos.casillero ? true : undefined}
                aria-describedby={
                  motivos.casillero ? idMotivoCasillero : undefined
                }
                value={casillero}
                disabled={ocupado}
                onChange={(e) => setCasillero(e.target.value)}
              />
              {motivos.casillero && (
                <span
                  id={idMotivoCasillero}
                  className="mt-1 block text-xs text-error"
                >
                  {motivos.casillero}
                </span>
              )}
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-1"
              checked={aceptaFisico}
              disabled={ocupado}
              aria-invalid={motivos.fisico ? true : undefined}
              aria-describedby={motivos.fisico ? idMotivoFisico : undefined}
              onChange={(e) => setAceptaFisico(e.target.checked)}
            />
            <span className="flex-1">
              <span className="font-medium">Físico (domicilio)</span>
              {/* Editable, no de solo lectura: viene del EPAS, pero la gente se muda y las
                  direcciones llegan con erratas. Corregirla NO reescribe los despachos ya
                  abiertos — cada uno congeló la suya. */}
              <input
                className="input input-bordered input-sm mt-1 w-full"
                placeholder="Dirección del domicilio"
                aria-label="Dirección del domicilio"
                aria-invalid={motivos.fisico ? true : undefined}
                aria-describedby={describeDireccion}
                value={direccion}
                disabled={ocupado}
                onChange={(e) => setDireccion(e.target.value)}
              />
              {mostrarPistaSinDireccion && (
                <span
                  id="pista-direccion"
                  className="mt-1 block text-xs text-base-content/75"
                >
                  {PISTA_SIN_DIRECCION}
                </span>
              )}
              {motivos.fisico && (
                <span
                  id={idMotivoFisico}
                  className="mt-1 block text-xs text-error"
                >
                  {motivos.fisico}
                </span>
              )}
              {direccion.trim() !== (formas?.direccion ?? "").trim() && (
                <span className="mt-1 block text-xs opacity-70">
                  Antes: {formas?.direccion || ANTES_SIN_DIRECCION}
                </span>
              )}
            </span>
          </label>

          {/* Lo que pasa si no se marca ninguna, dicho antes de guardar —y, en el paso 3, antes de
              emitir—. Es un aviso, no un bloqueo: el servidor lo tolera y lo dice. */}
          {/* Solo con la lectura hecha. Sin ella no se sabe si hay formas o no, y afirmar «no hay
              ninguna» sería inventarse un dato: el error de arriba ya dice lo que pasa. */}
          {leido && ninguna && (
            <Alert variant="warning" message={mensajeSinFormas} />
          )}
        </div>
      )}

      {renderPie?.({ guardar, guardando, cargando, leido, ninguna })}
    </>
  );
};

export default FormasNotificacionCuerpo;
