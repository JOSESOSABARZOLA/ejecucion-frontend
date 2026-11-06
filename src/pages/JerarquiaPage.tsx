/**
 * Microservicio: ejecucion
 * Módulo: Jerarquía de usuarios (DME)
 * Feature: Panel de administración de la jerarquía (quick 261002-lds)
 * Archivo: JerarquiaPage.tsx
 * Responsabilidad: Pantalla del submenú «Jerarquia» (subm_path /home/jerarquia), EXCLUSIVA del
 *   administrador. Lista a los usuarios agrupados por rol y permite declarar, por cada uno, de
 *   quién depende.
 *
 *   ── POR QUÉ EXISTE ESTA PANTALLA ─────────────────────────────────────────────────────────────
 *   Porque la migración dejó de repartir a los decisores por `MIN(usu_id)`. Con DOS secretarios y
 *   DOS directores reales en el servidor, esa regla enseñaba los datos de desempeño de una persona
 *   al jefe equivocado. Quién reparte el trabajo a quién es dato de organización, y lo declara una
 *   persona: aquí.
 *
 *   ── LOS TRES ESTADOS, Y POR QUÉ SON TRES Y NO DOS ────────────────────────────────────────────
 *   (1) **«Sin declarar»** — no tiene fila. Es el estado de salida de TODOS los decisores tras el
 *       despliegue. 🔴 La pantalla dice la consecuencia con todas las letras: su superior no lo ve
 *       en el Tablero y, si esa persona tuviera gente a cargo, su propio Tablero sale vacío.
 *       Callarlo convertiría un tablero en blanco en un «está roto» que nadie sabría explicar.
 *   (2) **«Raíz»** — declarado SIN superior. Está dicho que no depende de nadie: es el director
 *       raíz, y es el administrador, que queda fuera de la cadena de mando a propósito.
 *   (3) **«Bajo <nombre>»** — con su superior declarado.
 *
 *   Quitar el superior lleva de (3) a (2), NUNCA a (1): el panel declara, no desdeclara. El modal
 *   lo dice.
 *
 *   ── EL FILTRO DEL DESPLEGABLE ES CONVENIENCIA, NO AUTORIDAD ──────────────────────────────────
 *   Se excluye al propio usuario y a sus descendientes, calculados en cliente desde la lista
 *   completa. Sirve para no ofrecer lo imposible, pero quien DECIDE es el backend —y sus
 *   invariantes son las que cuentan—, así que su error se muestra tal cual llegue.
 *
 *   Solo componentes del kit compartido (HeaderPage, Loading, EmptyState, Alert, Collapse, Boton,
 *   ConfirmationDetail): sin tablas ni botones a mano.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-02
 * Modificado por: Andrés Miño — 2026-10-28 (quick 261028-kmg: el fallo al cargar se dice en su
 *   hueco con «Reintentar» y sin afirmar el vacío; el fallo al guardar, tal cual, en el aviso
 *   flotante)
 */
import { mensajeParaUsuario } from "../api/mensajeParaUsuario";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import DialogoModal from "../components/common/DialogoModal";
import { useToast } from "../hooks/useToast";
import {
  JerarquiaService,
  type UsuarioJerarquia,
} from "../services/JerarquiaService";
import HeaderPage from "../components/common/HeaderPage";
import Loading from "../components/common/Loading";
import EmptyState from "../components/common/EmptyState";
import Alert from "../components/common/Alert";
import Collapse from "../components/collapse/Collapse";
import Boton from "../components/common/Boton";
import ConfirmationDetail from "../components/modals/ConfirmationDetail";

// Collapse<T> exige permittedActions; esta pantalla renderiza sus propias acciones (igual que
// ParametrosPage y las bandejas), así que pasa los tres contextos vacíos.
const EMPTY_COLLAPSE_ACTIONS = {
  collapseHeader: [],
  collapseBody: [],
  collapseBodyItem: [],
};

/** Lo que el modal está a punto de confirmar. `null` = no hay nada abierto. */
type Pendiente =
  | { tipo: "asignar"; usuario: UsuarioJerarquia; superior: UsuarioJerarquia }
  | { tipo: "quitar"; usuario: UsuarioJerarquia };

/** Cómo se lee el estado de una persona en la pantalla. Ver la cabecera: son TRES, no dos. */
const estadoDe = (u: UsuarioJerarquia): string => {
  if (!u.declarado) return "Sin declarar";
  if (u.superiorId === null) return "Raíz";
  return `Bajo ${u.superiorNombre ?? `#${u.superiorId}`}`;
};

/**
 * Los descendientes de `usuarioId`, calculados desde la lista completa.
 *
 * Se construye el mapa superior → hijos y se recorre hacia abajo. Lleva un conjunto de visitados
 * porque la tabla PUEDE contener ya un ciclo escrito a mano: sin él, un ciclo colgaría el
 * navegador, que es peor que no filtrar nada.
 */
const descendientesDe = (
  usuarioId: number,
  usuarios: UsuarioJerarquia[],
): Set<number> => {
  const hijosPorSuperior = new Map<number, number[]>();
  for (const u of usuarios) {
    if (u.superiorId === null) continue;
    const actuales = hijosPorSuperior.get(u.superiorId) ?? [];
    actuales.push(u.usuarioId);
    hijosPorSuperior.set(u.superiorId, actuales);
  }

  const encontrados = new Set<number>();
  const pendientes = [usuarioId];
  while (pendientes.length > 0) {
    const actual = pendientes.pop() as number;
    for (const hijo of hijosPorSuperior.get(actual) ?? []) {
      if (encontrados.has(hijo)) continue;
      encontrados.add(hijo);
      pendientes.push(hijo);
    }
  }
  return encontrados;
};

const JerarquiaPage = () => {
  const { addToast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioJerarquia[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Fallo al CARGAR: se dice en línea, en su hueco, con «Reintentar», y mientras falla no se afirma
   * el vacío (regla 3b de 261028-kmg). El fallo al guardar va al aviso flotante.
   */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  /** Superior elegido en el desplegable de cada fila, antes de confirmar. */
  const [seleccion, setSeleccion] = useState<Record<number, number | "">>({});
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const refrescar = useCallback(async () => {
    setLoading(true);
    try {
      setUsuarios(await JerarquiaService.listar());
      setErrorCarga(null);
    } catch (err) {
      setErrorCarga(mensajeParaUsuario(err, "No se pudo cargar la lista de usuarios."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  /** Los usuarios agrupados por rol, en el orden en que llegan (el backend ordena por rol). */
  const porRol = useMemo(() => {
    const grupos = new Map<string, UsuarioJerarquia[]>();
    for (const u of usuarios) {
      const actuales = grupos.get(u.rol) ?? [];
      actuales.push(u);
      grupos.set(u.rol, actuales);
    }
    return [...grupos.entries()];
  }, [usuarios]);

  const sinDeclarar = useMemo(
    () => usuarios.filter((u) => !u.declarado).length,
    [usuarios],
  );

  /** Candidatos a superior de una persona: todos menos ella misma y sus descendientes. */
  const candidatos = useCallback(
    (usuario: UsuarioJerarquia): UsuarioJerarquia[] => {
      const bajoEl = descendientesDe(usuario.usuarioId, usuarios);
      return usuarios.filter(
        (u) => u.usuarioId !== usuario.usuarioId && !bajoEl.has(u.usuarioId),
      );
    },
    [usuarios],
  );

  const confirmarPendiente = async () => {
    if (!pendiente) return;
    setConfirmando(true);
    try {
      if (pendiente.tipo === "asignar") {
        await JerarquiaService.asignarSuperior(
          pendiente.usuario.usuarioId,
          pendiente.superior.usuarioId,
        );
        addToast(
          "success",
          `${pendiente.usuario.nombre} pasa a depender de ${pendiente.superior.nombre}.`,
        );
      } else {
        await JerarquiaService.quitarSuperior(pendiente.usuario.usuarioId);
        addToast(
          "success",
          `${pendiente.usuario.nombre} queda declarado como raíz, sin superior.`,
        );
      }
      setSeleccion((previo) => ({
        ...previo,
        [pendiente.usuario.usuarioId]: "",
      }));
      setPendiente(null);
      await refrescar();
    } catch (err) {
      // 🔴 El error del backend se muestra TAL CUAL llega: sus mensajes nombran a las personas y
      // explican qué corregir («X ya está por encima de Y en la cadena de mando»). Reescribirlos
      // aquí los convertiría en un «no se pudo guardar» que no ayuda a nadie.
      addToast(
        "error",
        mensajeParaUsuario(err, "No se pudo guardar el superior. Intente más tarde."),
      );
      setPendiente(null);
    } finally {
      setConfirmando(false);
    }
  };

  const renderHeader = (usuario: UsuarioJerarquia): ReactNode => (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{usuario.nombre}</p>
        <p className="text-sm opacity-70">{usuario.correo}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-70">{usuario.rol}</span>
        {!usuario.declarado && (
          <span className="badge badge-warning">Sin declarar</span>
        )}
        {usuario.declarado && usuario.superiorId === null && (
          <span className="badge badge-info">Raíz</span>
        )}
        {usuario.declarado && usuario.superiorId !== null && (
          <span className="badge badge-ghost">{estadoDe(usuario)}</span>
        )}
      </div>
    </div>
  );

  const renderContent = (usuario: UsuarioJerarquia): ReactNode => {
    const elegido = seleccion[usuario.usuarioId] ?? "";
    const opciones = candidatos(usuario);

    return (
      <div className="flex flex-col gap-4 p-2">
        {/* 🔴 La consecuencia de «sin declarar», con todas las letras. Es el estado de salida de
            todos los decisores tras el despliegue, y un tablero en blanco sin esta frase se lee
            como una avería. */}
        {!usuario.declarado && (
          <Alert
            variant="warning"
            message={
              `${usuario.nombre} todavía no tiene superior declarado: NO aparece en el Tablero de ` +
              "nadie, y si tuviera gente a cargo su propio Tablero saldría vacío. Mientras siga " +
              "así, su trabajo no se cuenta en los indicadores de ningún jefe."
            }
          />
        )}

        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="flex min-w-[18rem] flex-col gap-1">
            <label
              className="font-medium"
              htmlFor={`superior-${usuario.usuarioId}`}
            >
              Superior
            </label>
            <select
              id={`superior-${usuario.usuarioId}`}
              className="select select-bordered w-full"
              value={elegido}
              onChange={(e) =>
                setSeleccion((previo) => ({
                  ...previo,
                  [usuario.usuarioId]:
                    e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
            >
              <option value="">Elija a quién reporta…</option>
              {opciones.map((candidato) => (
                <option key={candidato.usuarioId} value={candidato.usuarioId}>
                  {candidato.nombre} — {candidato.rol}
                </option>
              ))}
            </select>
          </fieldset>

          <Boton
            estilos="btn btn-sm btn-primary"
            texto="Guardar superior"
            deshabilitado={elegido === "" || elegido === usuario.superiorId}
            onClick={() => {
              const superior = usuarios.find((u) => u.usuarioId === elegido);
              if (!superior) return;
              setPendiente({ tipo: "asignar", usuario, superior });
            }}
          />

          <Boton
            estilos="btn btn-sm btn-ghost"
            texto="Quitar superior"
            // Solo tiene sentido si HAY superior que quitar. Sobre alguien «sin declarar» no es
            // una operación distinta de no hacer nada, y sobre una raíz ya declarada tampoco.
            deshabilitado={usuario.superiorId === null}
            onClick={() => setPendiente({ tipo: "quitar", usuario })}
          />
        </div>

        <p className="text-sm opacity-70">
          Estado actual: <strong>{estadoDe(usuario)}</strong>
        </p>
      </div>
    );
  };

  return (
    <div className="app-modules-page">
      <HeaderPage
        headerKicker="Ejecución — DME"
        // 🔴 El rótulo SÍ lleva tilde. El `subm_name` sembrado va sin ella, porque la grafía de
        // `t_submenus` se compara carácter por carácter en el gate de la matriz de menú.
        title="Jerarquía de usuarios"
        subtitle="Quién reporta a quién. Es lo que decide el alcance del Tablero de indicadores: el superior de una persona es quien ve sus plazos y su carga de trabajo."
      />

      {errorCarga && (
        <Alert
          variant="error"
          message={errorCarga}
          buttonFunction={() => void refrescar()}
        />
      )}

      {!loading && sinDeclarar > 0 && (
        <Alert
          variant="warning"
          message={
            `Hay ${sinDeclarar} usuario(s) sin superior declarado. Hasta que se declaren, su ` +
            "trabajo no se cuenta en el Tablero de nadie. Es el estado normal recién desplegado, " +
            "no una avería."
          }
        />
      )}

      {loading && <Loading />}

      {!loading && !errorCarga && usuarios.length === 0 && (
        <EmptyState text="No hay usuarios registrados en el módulo." />
      )}

      <div className="flex flex-col gap-6">
        {porRol.map(([rol, delRol]) => (
          <section key={rol} className="flex flex-col gap-2">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary/90">
              {rol}
            </p>
            {delRol.map((usuario, i) => (
              <Collapse
                key={usuario.usuarioId}
                data={usuario}
                index={i}
                permittedActions={EMPTY_COLLAPSE_ACTIONS}
                headerRender={renderHeader}
                contentRender={renderContent}
                className="app-collapse-alert app-inbox-alert-item"
                summaryClassName="app-collapse-alert-summary"
                contentClassName="app-collapse-alert-content"
              />
            ))}
          </section>
        ))}
      </div>

      {/* CONFIRMACIÓN QUE DECLARA LA CONSECUENCIA REAL: no es un dato de ficha, es quién ve los
          indicadores de desempeño de una persona. */}
      {pendiente && (
        <DialogoModal
          className="modal modal-open"
          onCerrar={() => setPendiente(null)}
          ocupado={confirmando}
        >
          <ConfirmationDetail
            headerKicker="Ejecución — DME"
            headerTitle={
              pendiente.tipo === "asignar"
                ? `Declarar el superior de ${pendiente.usuario.nombre}`
                : `Dejar a ${pendiente.usuario.nombre} sin superior`
            }
            statusCopy="Revise el cambio antes de guardar"
            descriptionCopy={
              pendiente.tipo === "asignar"
                ? "Este cambio decide QUIÉN VE LOS INDICADORES DE DESEMPEÑO de esta persona en el Tablero: sus plazos, sus devoluciones y su carga pasan a contarse en el tablero de su nuevo superior, y dejan de contarse en el del anterior."
                : "Esta persona queda declarada como RAÍZ: no dependerá de nadie y DESAPARECERÁ del Tablero de quien la tenía a cargo. No vuelve a «sin declarar» — la declaración se conserva, solo que sin superior."
            }
            informationData={
              pendiente.tipo === "asignar"
                ? {
                    Persona: pendiente.usuario.nombre,
                    Rol: pendiente.usuario.rol,
                    Antes: estadoDe(pendiente.usuario),
                    Después: `Bajo ${pendiente.superior.nombre}`,
                  }
                : {
                    Persona: pendiente.usuario.nombre,
                    Rol: pendiente.usuario.rol,
                    Antes: estadoDe(pendiente.usuario),
                    Después: "Raíz (sin superior)",
                  }
            }
            onConfirm={confirmarPendiente}
            onClose={() => setPendiente(null)}
            confirmButtonText="Sí, guardar"
            confirmButtonLoadingText="Guardando…"
            confirmDisabled={confirmando}
          />
        </DialogoModal>
      )}
    </div>
  );
};

export default JerarquiaPage;
