/**
 * Microservicio: ejecucion
 * Módulo: Parámetros del módulo (DME)
 * Feature: Parámetros administrables sin redespliegue (plazos 03.13 + económicos 03.14)
 * Archivo: ParametrosPage.tsx
 * Responsabilidad: Pantalla del submenú "Parámetros" (subm_path /home/parametros), EXCLUSIVA del
 *   administrador. Lista los parámetros con su valor, su unidad y su histórico desplegable inline
 *   (D-13), y permite editarlos: los PLAZOS (03.13, 03.17 y 261030-m29) y los tres ECONÓMICOS del trabajo
 *   comunitario (03.14) — SBU vigente, tope de compensación y horas por SBU—, con los que se genera
 *   el cuadro de las providencias. El SBU cambia cada año y esta pantalla es donde se actualiza.
 *
 *   ── LAS DOS COSAS QUE ESTA PANTALLA TIENE QUE DECIR, Y NO SON DECORATIVAS ─────────────────────
 *   (1) **A QUIÉN NO AFECTA UN CAMBIO** (D-12). El modal lo declara con todas las letras: rige solo
 *       para expedientes que arranquen su reloj a partir de ahora; los que están en curso conservan
 *       el suyo. Es el punto que más se malinterpreta de toda la fase — sin esa frase, un
 *       administrador puede creer que acaba de mover los plazos de todos los expedientes vivos.
 *   (2) **CUÁNDO EL VALOR NO VIENE DE LA TABLA** (mitad (b) de D-08). Un parámetro con `origen:"env"`
 *       se sirve del entorno porque su fila todavía no está. Se muestra con su badge y su aviso —el
 *       respaldo no puede ser invisible—, pero **sí se puede editar**: al guardar, el backend crea
 *       la fila y a partir de ahí manda la tabla (decisión del usuario, 2026-08-17). Antes la
 *       edición se deshabilitaba, y eso dejaba al administrador mirando un valor que no podía
 *       cambiar sin pasar por la base de datos.
 *
 *   Solo componentes del kit compartido (HeaderPage, Collapse, Boton, Alert, EmptyState, Loading,
 *   ConfirmationDetail, DatetimeUtil): sin tablas ni botones a mano.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-13
 * Modificado por: Andrés Miño — 2026-10-16 (Fase 03.23, Plan 11 — D-13/D-14: se retira la sección
 *   de aptitud por materia para trabajo comunitario y el subtítulo deja de prometerla. La aptitud la
 *   decide ahora la infracción en CORE, no una declaración por materia en esta pantalla)
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al cargar se dice en su
 *   hueco con «Reintentar» y sin afirmar el vacío; el fallo al guardar, en el aviso flotante)
 * Modificado por: Andrés Miño — 2026-11-04 (quick 261030-m29: `esPlazo` reconoce también los plazos
 *   en días HÁBILES —el término de alegación y los dos de las alertas—, que antes caían como
 *   económicos y con 0 daban el aviso del cuadro de trabajo comunitario; revisión IN-08: el 0 de la
 *   anticipación del aviso del TC tiene su propio aviso)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — un parámetro en USD, el SBU, se lee
 *   «USD 460,00» con `formatearUsd` en la cabecera, el histórico y la confirmación; los plazos, el
 *   tope en SBU y las horas no cambian. La casilla sigue numérica: el dominio es ENTERO ≥ 0 y no
 *   hay coma decimal que malinterpretar)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useToast } from "../hooks/useToast";
import {
  ParametroService,
  ETIQUETA_PARAMETRO,
  ETIQUETA_UNIDAD,
  UNIDADES_POR_CLAVE,
  type CambioParametro,
  type ParametroClave,
  type ParametroVigente,
  type UnidadParametro,
} from "../services/ParametroService";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert from "../components/common/Alert";
import Collapse from "../components/collapse/Collapse";
import Boton from "../components/common/Boton";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";
import { DatetimeUtil } from "../utils/datetime.util";
import { formatearUsd } from "../utils/importe.util";

// Collapse<T> exige permittedActions; esta pantalla renderiza sus propias acciones (igual que las
// bandejas), así que pasa los tres contextos vacíos.
const EMPTY_COLLAPSE_ACTIONS = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

/** Edición en curso de un parámetro. `null` = no hay ninguna abierta. */
interface EdicionEnCurso {
  clave: ParametroClave;
  valorAnterior: number;
  unidadAnterior: UnidadParametro;
  valor: string;
  unidad: UnidadParametro;
}

/**
 * Un valor con su unidad, como se lee en pantalla. El dinero (unidad USD) va con el formateador
 * único del módulo —«USD 460,00», igual que en el compositor y en el PDF—; lo demás (días, SBU como
 * cantidad, horas) sigue siendo «valor + etiqueta». Sin valor —la casilla vacía— se pinta «—».
 */
const valorConUnidad = (
  valor: number | string,
  unidad: UnidadParametro,
): string => {
  if (String(valor).trim() === "") {
    return unidad === "USD" ? "—" : `— ${ETIQUETA_UNIDAD[unidad]}`;
  }
  const numero = Number(valor);
  return unidad === "USD" && Number.isFinite(numero)
    ? formatearUsd(numero)
    : `${valor} ${ETIQUETA_UNIDAD[unidad]}`;
};

/**
 * ¿Es un plazo? Se deriva de las unidades que admite la clave, no de una segunda lista de claves que
 * pudiera desincronizarse. Los económicos (SBU, tope, horas) no cuentan tiempo, así que ni ofrecen
 * elección de unidad ni les aplica la advertencia del plazo que vence al arrancar.
 */
const esPlazo = (clave: ParametroClave): boolean =>
  UNIDADES_POR_CLAVE[clave].includes("CALENDARIO") ||
  UNIDADES_POR_CLAVE[clave].includes("HABILES");

/**
 * Qué significa un 0 en cada parámetro. La anticipación del aviso del trabajo comunitario cuenta en
 * días hábiles pero NO es un plazo que venza: con 0 el aviso sale el mismo día del vencimiento
 * (revisión 261030-m29, IN-08).
 */
const advertenciaDelCero = (clave: ParametroClave): string => {
  if (clave === "AVISO_PREVIO_TRABAJO_COMUNITARIO") {
    return "Con 0 el aviso sale el mismo día en que vence el plazo del trabajo comunitario.";
  }
  return esPlazo(clave)
    ? "Un plazo de 0 vence en el mismo instante en que arranca."
    : "Con 0 no se puede generar el cuadro de trabajo comunitario de las providencias.";
};

const ParametrosPage = () => {
  const { addToast } = useToast();
  const [parametros, setParametros] = useState<ParametroVigente[]>([]);
  const [historicos, setHistoricos] = useState<
    Partial<Record<ParametroClave, CambioParametro[]>>
  >({});
  const [loading, setLoading] = useState(true);
  /**
   * Fallo al CARGAR: se dice en línea, en su hueco, con «Reintentar», y mientras falla no se afirma
   * el vacío (regla 3b de 261028-kmg). El fallo al guardar va al aviso flotante.
   */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<EdicionEnCurso | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const refrescar = useCallback(async () => {
    setLoading(true);
    try {
      setParametros(await ParametroService.listar());
      setErrorCarga(null);
    } catch (err) {
      setErrorCarga(mensajeParaUsuario(err, "No se pudieron cargar los parámetros del módulo."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  /** El histórico se pide solo al desplegar: no se cargan tres historiales que nadie ha abierto. */
  const cargarHistorico = useCallback(
    async (clave: ParametroClave) => {
      if (historicos[clave]) return;
      try {
        const filas = await ParametroService.historico(clave);
        setHistoricos((previo) => ({ ...previo, [clave]: filas }));
      } catch {
        setHistoricos((previo) => ({ ...previo, [clave]: [] }));
      }
    },
    [historicos],
  );

  const abrirEdicion = (parametro: ParametroVigente) =>
    setEdicion({
      clave: parametro.clave,
      valorAnterior: parametro.valor,
      unidadAnterior: parametro.unidad,
      valor: String(parametro.valor),
      unidad: parametro.unidad,
    });

  const valorEditadoEsValido = (() => {
    if (!edicion) return false;
    const n = Number(edicion.valor);
    // Mismo dominio que el DTO y que el CHECK de la tabla: entero >= 0, sin tope de política.
    return Number.isInteger(n) && n >= 0;
  })();

  const hayCambio =
    !!edicion &&
    (Number(edicion.valor) !== edicion.valorAnterior ||
      edicion.unidad !== edicion.unidadAnterior);

  const confirmarCambio = async () => {
    if (!edicion) return;
    setConfirmando(true);
    try {
      await ParametroService.actualizar(
        edicion.clave,
        Number(edicion.valor),
        edicion.unidad,
      );
      addToast(
        "success",
        `${ETIQUETA_PARAMETRO[edicion.clave]} actualizado. Rige para los expedientes que arranquen su reloj desde ahora.`,
      );
      // El histórico de ESA clave queda obsoleto: se olvida para que se vuelva a pedir al desplegar.
      setHistoricos((previo) => ({ ...previo, [edicion.clave]: undefined }));
      setEdicion(null);
      await refrescar();
    } catch (err) {
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo guardar el parámetro. Intente más tarde."),
      );
    } finally {
      setConfirmando(false);
    }
  };

  const renderHeader = (parametro: ParametroVigente): ReactNode => (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{ETIQUETA_PARAMETRO[parametro.clave]}</p>
        <p className="text-sm opacity-70">{parametro.descripcion}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">
          {valorConUnidad(parametro.valor, parametro.unidad)}
        </span>
        {/* 🔴 Mitad (b) de D-08: el respaldo del .env NO puede ser invisible. */}
        {parametro.origen === "env" && (
          <span className="badge badge-warning">Viene del .env</span>
        )}
      </div>
    </div>
  );

  const renderContent = (parametro: ParametroVigente): ReactNode => {
    const historico = historicos[parametro.clave];
    return (
      <div className="flex flex-col gap-4 p-2">
        {parametro.origen === "env" && (
          <Alert
            variant="warning"
            message="Este valor NO viene de la tabla, sino del archivo de entorno: su fila no existe todavía. Puede editarlo igualmente: al guardar se crea la fila y, a partir de ahí, manda la tabla."
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Boton
            estilos="btn btn-sm btn-primary"
            texto="Editar"
            // Editable SIEMPRE, incluso si el valor viene del .env: guardarlo crea su fila.
            deshabilitado={false}
            onClick={() => abrirEdicion(parametro)}
          />
          {parametro.updatedAt && (
            <span className="text-sm opacity-70">
              Último cambio: {DatetimeUtil.formatDate(parametro.updatedAt)}
            </span>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
            Histórico de cambios
          </p>
          {!historico && <p className="text-sm opacity-70">Cargando…</p>}
          {historico?.length === 0 && (
            <p className="text-sm opacity-70">
              Este parámetro no se ha modificado desde que se sembró.
            </p>
          )}
          {!!historico?.length && (
            <div className="flex flex-col gap-1">
              {historico.map((cambio, i) => (
                <div
                  key={`${cambio.cambiadoAt}-${i}`}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="opacity-70">
                    {DatetimeUtil.formatDate(cambio.cambiadoAt)}
                  </span>
                  <span>
                    {valorConUnidad(cambio.valorAnterior, cambio.unidadAnterior)}
                    {" → "}
                    <strong>
                      {valorConUnidad(cambio.valorNuevo, cambio.unidadNueva)}
                    </strong>
                  </span>
                  <span className="opacity-70">
                    por {cambio.cambiadoPor ?? `usuario #${cambio.cambiadoBy}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-modules-page">
      <HeaderPage
        headerKicker="Ejecución — DME"
        title="Parámetros del módulo"
        subtitle="Lo que la Dirección administra sin redespliegue: plazos y cifras del trabajo comunitario. Un cambio rige solo para los expedientes que arranquen después de guardarlo."
      />

      {errorCarga && (
        <Alert
          variant="error"
          message={errorCarga}
          buttonFunction={() => void refrescar()}
        />
      )}

      {!loading && !errorCarga && parametros.length === 0 && (
        <EmptyState text="No hay parámetros configurados. ¿Se aplicó la migración del módulo?" />
      )}

      <div className="flex flex-col gap-2">
        {parametros.map((parametro, i) => (
          <Collapse
            key={parametro.clave}
            data={parametro}
            index={i}
            permittedActions={EMPTY_COLLAPSE_ACTIONS}
            headerRender={renderHeader}
            contentRender={renderContent}
            className="app-collapse-alert app-inbox-alert-item"
            summaryClassName="app-collapse-alert-summary"
            contentClassName="app-collapse-alert-content"
            onChange={(e) => {
              if (e.currentTarget.open) void cargarHistorico(parametro.clave);
            }}
          />
        ))}
      </div>

      {/* CONFIRMACIÓN QUE DECLARA A QUIÉN NO AFECTA (D-12). */}
      {edicion && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setEdicion(null)}
          hayCambios={hayCambio}
          ocupado={confirmando}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle={`Cambiar ${ETIQUETA_PARAMETRO[edicion.clave]}`}
            statusCopy="Revise el cambio antes de guardar"
            descriptionCopy="Este cambio rige SOLO para los expedientes que arranquen su reloj a partir de ahora; los que están en curso conservan el plazo con el que nacieron."
            informationData={{
              Parámetro: ETIQUETA_PARAMETRO[edicion.clave],
              Antes: valorConUnidad(edicion.valorAnterior, edicion.unidadAnterior),
              Después: valorConUnidad(edicion.valor, edicion.unidad),
            }}
            onConfirm={confirmarCambio}
            onClose={() => setEdicion(null)}
            confirmButtonText="Sí, guardar"
            confirmButtonLoadingText="Guardando…"
            confirmDisabled={!valorEditadoEsValido || !hayCambio || confirmando}
          >
            <div className="app-modules-modal-content flex flex-col gap-3">
              <fieldset className="flex flex-col gap-1">
                <label className="font-medium" htmlFor="parametro-valor">
                  Valor
                </label>
                <input
                  id="parametro-valor"
                  type="number"
                  min={0}
                  step={1}
                  className="input input-bordered w-full"
                  value={edicion.valor}
                  disabled={confirmando}
                  onChange={(e) =>
                    setEdicion({ ...edicion, valor: e.target.value })
                  }
                />
                {!valorEditadoEsValido && (
                  <span className="text-sm text-error">
                    El valor debe ser un número entero de 0 o más.
                  </span>
                )}
                {valorEditadoEsValido && Number(edicion.valor) === 0 && (
                  // El 0 se admite (D-05) pero su consecuencia no puede ser una sorpresa, y no es
                  // la misma en un plazo que en un parámetro económico.
                  <span className="text-sm text-warning">
                    {advertenciaDelCero(edicion.clave)}
                  </span>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-1">
                <label className="font-medium" htmlFor="parametro-unidad">
                  Unidad
                </label>
                {/* Un parámetro con una sola unidad posible no se pregunta: se declara. Ofrecer un
                    selector de una opción invita a creer que hay algo que elegir. */}
                {UNIDADES_POR_CLAVE[edicion.clave].length === 1 ? (
                  <span
                    id="parametro-unidad"
                    className="input input-bordered flex w-full items-center opacity-70"
                  >
                    {ETIQUETA_UNIDAD[edicion.unidad]}
                  </span>
                ) : (
                  <select
                    id="parametro-unidad"
                    className="select select-bordered w-full"
                    value={edicion.unidad}
                    disabled={confirmando}
                    onChange={(e) =>
                      setEdicion({
                        ...edicion,
                        unidad: e.target.value as UnidadParametro,
                      })
                    }
                  >
                    {UNIDADES_POR_CLAVE[edicion.clave].map((unidad) => (
                      <option key={unidad} value={unidad}>
                        {ETIQUETA_UNIDAD[unidad]}
                      </option>
                    ))}
                  </select>
                )}
              </fieldset>
            </div>
          </ConfirmationDetail>
        </DialogoModal>
      )}

      {loading && <Loading />}
    </div>
  );
};

export default ParametrosPage;
