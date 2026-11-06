/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/ordenes-pago (frontend)
 * Feature: La orden de pago se teclea DENTRO de «Mis Expedientes» (Fase 03.22, Plan 02 — D-05/D-06)
 * Archivo: CeldaOrden.tsx
 * Responsabilidad: Pintar, en una celda de la bandeja del decisor, la orden de pago vigente de un
 *   tipo (multa o remanente) con su estado y su «Anular», o el campo con el que se registra una
 *   nueva. No hay botón «Guardar»: se confirma con `Enter` o al salir del campo, que es lo que
 *   convierte «muchos pasos» en uno y la razón por la que el área usuaria ya la usa así.
 *
 *   ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────────────────────
 *   Es el PORTE de la celda `celdaOrden` de la bandeja APARTE de órdenes de pago, la pantalla que
 *   esta misma fase retiró en su Plan 04 (D-01) — el fichero ya no existe; vivió del 2026-09-03 al
 *   2026-09-24 en `src/pages/`, y su historia se lee en el git log de esa ruta. D-05 congela la
 *   interacción: número + badge + acción dentro de la misma celda. Lo que
 *   sí cambia son las CUATRO correcciones medidas del contrato de UI (§2.3), cada una anotada abajo
 *   con su medición: copiar el porte tal cual las habría vuelto permanentes.
 *
 *   ── 🔴 POR QUÉ EL BORRADOR VIVE AQUÍ Y NO EN LA PÁGINA ───────────────────────────────────────
 *   La pantalla retirada guardaba lo tecleado en dos mapas de la página indexados por
 *   `${eejeId}:${tipo}`. En «Mis Expedientes» eso sería un defecto: el array `columnas` va
 *   memoizado, y el comentario de cabecera de ese memo advierte que una identidad nueva por render
 *   es un BUCLE DE PETICIONES contra un endpoint que lleva cédulas y direcciones. Un mapa de
 *   borradores en la página entraría en las dependencias del `useMemo` y produciría una identidad
 *   nueva POR PULSACIÓN DE TECLA. Con el estado dentro de la celda, el memo conserva sus
 *   dependencias estables — y por eso la página monta esta celda con `key={`${eejeId}:${tipo}`}`:
 *   React conserva el estado local por posición, así que sin la clave un borrador podría «bajar» a
 *   otra fila al cambiar de página o de filtro.
 *
 *   ⚠️ El `AGENTS.md` de este repositorio es una copia sin rebrandear del frontend de Resolución y
 *   nombra otro microservicio y otro desarrollador. Manda el repo (`menuRoutes.test.ts`,
 *   `RutaProtegida.tsx`), no ese archivo heredado.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-24
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 06 — gap 1 del UAT / diferido D1 del
 *   contrato de UI: la confirmación de «Anular» pasa del diálogo del navegador al cascarón del
 *   módulo. La celda NO se rediseña: D-05 sigue en pie y lo único que cambia es el ENVOLTORIO de
 *   esa confirmación.)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: la orden que no se puede teclear porque
 *   el expediente está suspendido por la impugnación lo dice, en vez de un «Pendiente» mudo)
 */
import { mensajeParaUsuario } from "../../api/mensajeParaUsuario";
import { useState } from "react";
import DialogoModal from "../common/DialogoModal";
import { createPortal } from "react-dom";
import Boton from "../common/Boton";
import ModalAnularOrden from "./ModalAnularOrden";
import { useToast } from "../../hooks/useToast";
import {
  OrdenPagoService,
  type TipoOrdenPago,
} from "../../services/OrdenPagoService";
import type { MiEpasAsignado } from "../../services/SorteoService";

/** Cómo se nombra el tipo dentro de una frase. El `id` de la columna no se lee en voz alta. */
const TIPO_EN_PALABRAS: Record<TipoOrdenPago, string> = {
  MULTA: "multa",
  REMANENTE: "remanente",
};

/**
 * El respaldo del error de registro: sólo entra cuando lo capturado no es un `Error` con mensaje.
 * Manda el mensaje del servidor; éste dice qué hacer, que es lo que al porte le faltaba.
 */
/**
 * Por qué no se puede teclear la orden mientras dura la impugnación (quick 261028-mtg). El servidor ya
 * manda `ordenes.editable: false` en EN_IMPUGNACION; esto solo dice POR QUÉ, para que el decisor no
 * lo lea como «no es suyo».
 */
const SUSPENDIDA_POR_IMPUGNACION =
  "El expediente está suspendido por la impugnación: no se registran ni anulan órdenes de pago hasta que la Procuraduría resuelva el recurso.";

const RESPALDO_REGISTRAR =
  "No se pudo registrar la orden. Revise el número e intente nuevamente; si el problema continúa, comuníquelo al administrador del sistema.";

type CeldaOrdenProps = {
  row: MiEpasAsignado;
  tipo: TipoOrdenPago;
  /** Recarga de la bandeja del HOST tras un éxito: conserva filtros y página (no es un remontaje). */
  onRegistrada: () => void | Promise<void>;
};

const CeldaOrden = ({ row, tipo, onRegistrada }: CeldaOrdenProps) => {
  const { addToast } = useToast();

  /** Lo tecleado mientras no se haya registrado. Estado LOCAL: ver la cabecera del archivo. */
  const [borrador, setBorrador] = useState("");
  /** Petición en curso: el campo se deshabilita para no registrar dos veces el mismo número. */
  const [guardando, setGuardando] = useState(false);
  /**
   * La orden cuya anulación se está confirmando, o nada. Estado LOCAL por la misma razón que el
   * borrador: un mapa en la página entraría en las dependencias del memo de `columnas`.
   */
  const [anulando, setAnulando] = useState<{
    ordpId: number;
    numero: string;
  } | null>(null);

  const ordenes = row.ordenes;
  const nombre = row.expNumber ?? row.eejeId;

  /**
   * Registra el número tecleado.
   *
   * 🔴 EL BORRADOR SE LIMPIA SÓLO TRAS EL ÉXITO. Si el backend rechaza —número mal formado,
   * expediente ajeno, orden ya vigente— lo escrito sigue en pantalla para poder corregirlo. Vaciar
   * el campo al fallar obligaría a teclearlo otra vez para averiguar qué estaba mal. La invariante
   * viene del porte y se conserva con su razón.
   */
  const registrar = async () => {
    const numero = borrador.trim();
    if (!numero || guardando) return;
    // GUARDA: sin `eeje_id` no hay expediente al que pegarle (`POST /ordenes-pago` lo exige). Se
    // dice honesto en vez de mandar `undefined` y leer un 400 que no explica nada.
    if (row.eejeId == null) {
      addToast(
        "error",
        "Este expediente no tiene un identificador resuelto; no se puede registrar la orden. Actualice la bandeja e intente nuevamente.",
      );
      return;
    }

    setGuardando(true);
    try {
      await OrdenPagoService.registrar(row.eejeId, tipo, numero);
      addToast(
        "success",
        `Orden ${numero} registrada en el expediente ${nombre}`,
      );
      setBorrador("");
      await onRegistrada();
    } catch (err) {
      // Solo el texto SEGURO del error (el del servidor o el genérico): nunca el de un error JS.
      const motivo = mensajeParaUsuario(err, "").replace(/\.+$/, "");
      addToast(
        "error",
        motivo
          ? `No se pudo registrar la orden: ${motivo}. Corrija el número y vuelva a intentarlo.`
          : RESPALDO_REGISTRAR,
      );
    } finally {
      setGuardando(false);
    }
  };

  // 🔴 SIN BLOQUE `ordenes` NO HAY MARCA DE ESCRITURA QUE OBEDECER, y la pantalla no se la inventa
  // (D-04, CH-5): ni un valor por defecto, ni una caída, ni comparar el decisor de la fila con el
  // del usuario autenticado. Se pinta la rama de sólo lectura, que es la conservadora.
  if (!ordenes) {
    // C1 — sube de la opacidad 60 del porte a `opacity-75`: medido 3,4:1 en tema claro sobre la
    // banda impar del zebra, contra el 4,5:1 que pide AA. `opacity-75` despeja las CUATRO
    // combinaciones (dos temas × dos bandas) con margen. Alcance estricto: sólo esta celda.
    return <span className="opacity-75">Pendiente</span>;
  }

  const orden = tipo === "MULTA" ? ordenes.multa : ordenes.remanente;

  if (orden) {
    const pagada = orden.estado === "PAGADA";

    // Sin `flex-wrap` a propósito: con `table-layout: auto` la columna se ensancha hasta caber y el
    // desplazamiento horizontal ya existe; envolver produciría filas de alto variable.
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono">{orden.numero}</span>
        <span
          className={`badge badge-sm ${pagada ? "badge-success" : "badge-ghost"}`}
        >
          {pagada ? "Pagada" : "Registrada"}
        </span>
        {ordenes.editable && (
          // C2 — «Anular» sube del tamaño extra pequeño del porte: 24px/11px → 32px/12px. Dos
          // razones medidas: 11px está fuera de la escala tipográfica declarada, y 32px iguala la
          // altura del campo, así que la fila no salta entre una celda vacía y una con orden —que
          // con 1 de 157 expedientes con orden vigente sería la única fila distinta de la página.
          // El nombre accesible es NUEVO: sin él son hasta 20 botones que se anuncian «Anular».
          <Boton
            estilos="btn btn-sm btn-ghost"
            texto="Anular"
            etiquetaAccesible={`Anular la orden ${orden.numero} (${TIPO_EN_PALABRAS[tipo]}) del expediente ${nombre}`}
            deshabilitado={false}
            onClick={() =>
              setAnulando({ ordpId: orden.ordpId, numero: orden.numero })
            }
          />
        )}
        {/* 🔴 EL PORTAL NO ES UN ADORNO. Esta celda se pinta dentro de un `<td>`, o sea dentro de
            `.app-data-table-shell`, que declara `container-type: inline-size` (`tables.css`) y al
            que la bandeja añade `overflow-x-auto`. La contención de layout
            que trae `container-type` convierte ese `div` en BLOQUE CONTENEDOR de los descendientes
            `position: fixed` —y `.modal` de daisyUI lo es—, así que sin el portal el diálogo se
            posicionaría contra la TABLA en vez de contra la ventana y su `overflow` lo recortaría.
            El repositorio ya tropezó con el mismo mecanismo y lo dejó escrito en
            `EmitirProvidenciaModal.tsx`; hay un segundo precedente en `MenuAccionesCaso.tsx`.
            Es lo único que ninguna prueba puede afirmar —jsdom no calcula CSS— y por eso va al
            UAT: si el diálogo aparece encajado dentro del recuadro de la tabla, el portal falta. */}
        {anulando &&
          createPortal(
            <DialogoModal
              className="modal modal-open"
              onCerrar={() => setAnulando(null)}
            >
              <ModalAnularOrden
                ordpId={anulando.ordpId}
                numero={anulando.numero}
                tipo={tipo}
                expediente={String(nombre)}
                onClose={() => setAnulando(null)}
                onAnulada={onRegistrada}
              />
            </DialogoModal>,
            document.body,
          )}
      </div>
    );
  }

  if (!ordenes.editable && row.eejeStatus === "EN_IMPUGNACION") {
    // La marca la puso el SERVIDOR (no editable en EN_IMPUGNACION); aquí solo se elige qué decir.
    return (
      <span className="opacity-75" title={SUSPENDIDA_POR_IMPUGNACION}>
        Suspendida por impugnación
      </span>
    );
  }

  if (!ordenes.editable) {
    // No es suyo: se dice que falta, y de quién es NO se dice — a quien no le pertenece tampoco le
    // corresponde saberlo (mismo criterio que el mensaje del guard de pertenencia). C1 otra vez.
    return <span className="opacity-75">Pendiente</span>;
  }

  // C3 — el campo pierde el modificador de borde que el porte arrastra de daisyUI 4: CERO
  // apariciones en daisyUI 5.5.19, o sea que no hace nada. Y `w-40` (160px) es un TOPE, no una
  // sugerencia: es lo que hace que el control quepa entero en la ventana visible a 360px junto a la
  // columna de acciones fijada (160px de 360px). No se ensancha.
  //
  // Mientras se guarda el campo va deshabilitado y nada más: sin spinner, sin skeleton, sin
  // overlay. Es una operación de sub-segundo y el resultado lo anuncia el toast.
  //
  // El marcador NO es el nombre accesible (regla A6 del 03.19): acompaña, no nombra.
  return (
    <input
      className="input input-sm w-40 font-mono"
      placeholder="N.º de orden"
      value={borrador}
      disabled={guardando}
      aria-label={`Número de orden (${TIPO_EN_PALABRAS[tipo]}) del expediente ${nombre}`}
      onChange={(e) => setBorrador(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void registrar();
      }}
      onBlur={() => void registrar()}
    />
  );
};

export default CeldaOrden;
