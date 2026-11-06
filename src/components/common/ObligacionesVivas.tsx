/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/obligacion-hacer (frontend)
 * Feature: Las DOS obligaciones vivas de un expediente, en la fila de la bandeja (Fase 03.18, Plan 08)
 * Archivo: ObligacionesVivas.tsx
 * Responsabilidad: Enseñar, en la fila y sin abrir el expediente, QUÉ DEBE todavía el administrado:
 *   la obligación PECUNIARIA (la multa que impuso la resolución de origen) y la obligación de HACER
 *   (el correctivo), con las señales que cambian lo que se puede hacer con él.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-15
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-jcy: sale el distintivo de la solicitud de
 *   retiro del sello de clausura, que el bloque ya no trae)
 * Modificado por: Andrés Miño — 2026-10-29 (quick 261028-mtg: chip «Término de alegación suspendido»
 *   cuando la impugnación detiene el término)
 * Modificado por: Andrés Miño — 2026-11-05 (quick 261105-cvq — la multa con `formatearUsd`,
 *   «USD 1.200,00»)
 *
 * ── 🔴 POR QUÉ EXISTE ESTE COMPONENTE ─────────────────────────────────────────────────────────
 * Porque el ARCHIVO del expediente exige que **las DOS** obligaciones estén cumplidas, y hasta hoy
 * las bandejas sólo enseñaban la pecuniaria. Una bandeja que enseña media obligación hace creer que
 * falta la mitad del trabajo cuando falta la otra mitad: el expediente parece listo para archivar
 * con la multa pagada mientras el correctivo sigue vivo. Enseñar las dos juntas es el criterio 6 de
 * esta fase, y no cuesta una línea de backend — el bloque `obligacionHacer` YA VIAJA en las cinco
 * superficies desde la Fase 03.16 (D-04).
 *
 * ── 🔴 ESTE COMPONENTE NO CALCULA NADA. LEE ───────────────────────────────────────────────────
 * Lee `tiene`, `cumplida` y el estado del término **tal y como llegan**. No hay
 * aquí ni una resta de fechas, ni una comparación con el reloj del navegador, ni una cuenta de la
 * serie de multas:
 *
 *   · los días del término son HÁBILES y se cuentan contra el calendario de feriados del SERVIDOR
 *     (`t_feriado_ejecucion`); restarlos aquí daría un número distinto del que el expediente
 *     sostiene, y un plazo que miente en pantalla es peor que no tener plazo;
 *   · el ORDINAL de la multa compulsoria sale de CONTAR la serie, y la fila NO trae la serie: el
 *     peldaño sólo viaja en `GET /obligacion-hacer/:eejeId`. Deducirlo aquí sería inventar un
 *     número que después se imprime en un acto notificado.
 *
 * Una prueba lee el fuente de este archivo para afirmar que esa aritmética no existe.
 *
 * ── 🔴 Y NO LEE EL ESTADO DEL EPAS ────────────────────────────────────────────────────────────
 * La rama del correctivo NO ES UNA MÁQUINA DE ESTADOS: está escrito que `EN_EJECUCION_HACER` no se
 * cableará nunca. Lo que dice si hay correctivo vivo son los HECHOS DERIVADOS del bloque, no una
 * etiqueta de estado. Mirar el campo de estado del EPAS para decidir qué pintar aquí sería
 * preguntarle a la pieza equivocada — y el nombre de ese campo no aparece ni una vez en este
 * archivo, que es lo que una prueba comprueba leyendo el fuente.
 *
 * ── DE DÓNDE SALEN LOS COLORES ────────────────────────────────────────────────────────────────
 * De `BadgePriority` y su `BADGE_GROUPS`, que es EL sistema de etiquetas del módulo. No se inventa
 * un segundo: se usan sus cuatro ranuras —`default` (información), `media` (aviso), `baja` (logrado)
 * y `alta` (urgente)— con `capitalize={false}`, porque estas etiquetas son frases y no palabras
 * sueltas.
 */
import type { FC } from "react";
import BadgePriority from "./BadgePriority";
import { formatearUsd } from "../../utils/importe.util";
import type { ObligacionHacerEnBandeja } from "../../interfaces/IObligacionHacer";

type ObligacionesVivasProps = {
  /**
   * La multa impuesta por la resolución sancionadora de origen, en dólares. `undefined` cuando no
   * consta —Resolución todavía no la emite en todo lo aterrizado antes del 2026-09-08—, y entonces
   * la etiqueta se OMITE: nunca «$ 0,00», que afirmaría que no se impuso nada.
   */
  multaImpuesta?: number;
  /**
   * El bloque del correctivo tal y como lo derivó el SERVIDOR para esta fila. Ninguno de sus campos
   * es una columna y ninguno se recalcula aquí.
   *
   * ⚠️ AUSENTE y `tiene: false` NO son lo mismo, aunque se pinten igual: lo primero es «esta
   * respuesta no trae el dato», lo segundo es «se miró y el expediente no lleva correctivo». Los dos
   * apagan la rama, y por eso ninguno de los dos pinta una etiqueta que sugiera lo contrario.
   */
  obligacionHacer?: ObligacionHacerEnBandeja;
};

/**
 * Las dos obligaciones vivas de un expediente, en una línea de etiquetas.
 *
 * Sin nada que decir —ni multa que consta ni correctivo— no devuelve un contenedor vacío: no
 * devuelve nada. Una fila sin obligaciones no tiene por qué reservar el hueco de las que no tiene.
 */
const ObligacionesVivas: FC<ObligacionesVivasProps> = ({
  multaImpuesta,
  obligacionHacer,
}) => {
  const hayPecuniaria =
    typeof multaImpuesta === "number" && Number.isFinite(multaImpuesta);

  // El correctivo se pinta SÓLO con el hecho `tiene` en verdadero. Ni el bloque ausente ni el
  // bloque con `tiene: false` dan pie a una etiqueta: en los dos casos, afirmar algo de la rama
  // sería afirmar algo que este componente no sabe.
  const correctivo = obligacionHacer?.tiene === true ? obligacionHacer : null;

  if (!hayPecuniaria && !correctivo) return null;

  // El término VENCIDO es el único estado del plazo que se grita en la fila, y es deliberado: es el
  // que HABILITA la multa compulsoria del art. 240 —no la dispara— y por tanto el único que cambia
  // lo que el decisor puede hacer hoy con el expediente. Los otros tres se explican con detalle en
  // la pantalla de la rama (`TerminoAlegacionPlazo`), donde el término es el contenido y no el
  // contexto; meter aquí la franja con su barra rompería la cabecera de la card.
  //
  // ⟳ quick 261028-mtg: el término SUSPENDIDO por la impugnación también se dice en la fila, por la
  // misma razón que el vencido: cambia lo que el decisor puede hacer hoy —nada corre ni se registra
  // hasta que la Procuraduría resuelva—. Va en tono de aviso (`media`) y no de urgencia, y EXCLUYE al
  // vencido: un término detenido no está vencido, y pintar los dos se contradiría.
  const terminoSuspendido =
    correctivo !== null && correctivo.terminoAlegacion.estado === "SUSPENDIDO";
  const terminoVencido =
    correctivo !== null &&
    !terminoSuspendido &&
    (correctivo.terminoAlegacion.estado === "VENCIDO" ||
      correctivo.terminoAlegacion.vencido);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* LA OBLIGACIÓN PECUNIARIA. Informativa: que exista una multa no es una alarma —es el acto
          normal del procedimiento—, y por eso va en el tono de información y no en el de aviso. */}
      {hayPecuniaria && (
        <BadgePriority
          text={`Multa: ${formatearUsd(multaImpuesta)}`}
          priority="default"
          size="md"
          capitalize={false}
        />
      )}

      {/* LA OBLIGACIÓN DE HACER. Cumplida cambia de tono a propósito: es la señal de que la mitad
          que nadie miraba ya está, y es lo que separa un expediente archivable de uno que no lo es
          aunque la multa esté pagada. */}
      {correctivo && (
        <BadgePriority
          text={
            correctivo.cumplida ? "Correctivo cumplido" : "Correctivo pendiente"
          }
          priority={correctivo.cumplida ? "baja" : "media"}
          size="md"
          capitalize={false}
        />
      )}

      {/* EL TÉRMINO. 🔴 HABILITA; NO DISPARA: no hay job y nadie emite nada por su cuenta. Esta
          etiqueta sólo le dice al decisor que el plazo de defensa se cumplió y que ya PUEDE imponer
          la multa del art. 240. El hecho lo derivó el servidor; aquí se lee, no se comprueba contra
          ningún reloj. */}
      {terminoVencido && (
        <BadgePriority
          text="Término de alegación vencido"
          priority="alta"
          size="md"
          capitalize={false}
        />
      )}

      {terminoSuspendido && (
        <BadgePriority
          text="Término de alegación suspendido"
          priority="media"
          size="md"
          capitalize={false}
        />
      )}
    </div>
  );
};

export default ObligacionesVivas;
