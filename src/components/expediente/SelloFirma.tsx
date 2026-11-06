/**
 * Microservicio: ejecucion
 * Módulo: Firma digital (frontend) — Expediente
 * Feature: El sello «Firmado» de un documento del expediente (Fase 03.21, D-15/D-26, UI-SPEC §8.1)
 * Archivo: SelloFirma.tsx
 * Responsabilidad: Decir de un documento si está firmado, quién lo firmó y cuándo. Tiene tres
 *   caras, y solo tres:
 *     · Con firmas: el sello «Firmado» (`badge badge-success badge-sm`, sólido, con el icono
 *       `firmado` decorativo) y debajo una línea por firma, en el orden en que se aplicaron:
 *       `{Decisor|Secretario|Director}: {nombre} · {26 oct 2026, 15:40}`.
 *     · Sin firmas y con `firmaRequerida` (D-26): el chip «Sin firma». Es la anomalía que el
 *       despacho también bloquea (D-09): se emitió con el firmador encendido y no salió firmado.
 *     · Todo lo demás —lo emitido con el firmador apagado o antes de encenderlo, y los documentos
 *       subidos—: NADA. Un «Sin firma» en cada anexo subido sería ruido que parece un defecto.
 *
 *   🔴 EL ESTADO SE DERIVA DE `firmas`, NUNCA DE `docStatus`. `docStatus` sigue siendo el ciclo
 *   borrador / emitida del acta y del Reception heredado: pintar el sello leyéndolo lo pondría y lo
 *   quitaría por razones que no tienen nada que ver con la firma. Y quien decide qué firmas hay es
 *   el SERVIDOR: este componente no deduce ninguna.
 *
 *   🔴 EL RÓTULO ES «Firmado» A SECAS, NUNCA «1 de 3». La UI no sabe cuántas casillas tiene cada
 *   documento y no lo debe deducir; las líneas ya dicen quién firmó, y un acta con una sola línea
 *   dice por sí misma que faltan dos.
 *
 *   🔴 PROHIBIDA LA VARIANTE SUAVE del badge de éxito: pinta el texto con el color de éxito sobre un
 *   tinte claro (~1,8:1), un sello que no se lee. El sólido da 6,8:1 / 8,4:1 (UI-SPEC § Color).
 *
 *   Componente tonto: no llama a ningún servicio. Lo montan las tres listas que leen
 *   `GET /epas/:eejeId/documentos` (UI-SPEC §8.2), para que un documento no se vea firmado en una y
 *   sin firmar en otra.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-10-26
 */
import type { FC } from "react";
import Iconos from "../common/Iconos";
import { DatetimeUtil } from "../../utils/datetime.util";
import type { FirmaDocumento } from "../../services/EpasService";

/**
 * El rótulo de cada rol en la línea de la firma. Es COPY de esta pantalla (UI-SPEC §8.1).
 *
 * ⚠️ NO se exporta: `react-refresh/only-export-components` solo tolera componentes en un archivo
 * `.tsx` (mismo criterio que `AvisosDeActo.tsx`). La prueba lo afirma a través del render.
 */
const ETIQUETA_ROL_FIRMA: Record<FirmaDocumento["rol"], string> = {
  decisor: "Decisor",
  secretario: "Secretario",
  director: "Director",
  revisor: "Revisor",
};

/** Lo que se escribe cuando el firmante ya no existe en la base, en vez de dejar un hueco. */
const FIRMANTE_SIN_NOMBRE = "firmante sin nombre registrado";

interface SelloFirmaProps {
  /** Las firmas aplicadas, en el orden en que se aplicaron. Llegan del servidor tal cual. */
  firmas?: FirmaDocumento[];
  /** El documento DEBÍA salir firmado (D-21/D-26). Solo cuenta cuando no hay firmas. */
  firmaRequerida?: boolean;
}

const SelloFirma: FC<SelloFirmaProps> = ({ firmas, firmaRequerida }) => {
  const aplicadas = firmas ?? [];

  if (aplicadas.length === 0) {
    // D-26 — el chip SOLO con `firmaRequerida === true`: lo emitido con el firmador apagado, antes
    // de encenderlo, o un documento subido no pintan nada.
    return firmaRequerida === true ? (
      <span className="badge badge-outline badge-sm">Sin firma</span>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="badge badge-success badge-sm gap-1">
        <span aria-hidden="true">
          <Iconos nombre="firmado" />
        </span>{" "}
        Firmado
      </span>
      {aplicadas.map((f) => (
        <span
          key={`${f.rol}-${f.at}`}
          className="text-xs text-base-content/70"
        >
          {ETIQUETA_ROL_FIRMA[f.rol] ?? f.rol}: {f.nombre ?? FIRMANTE_SIN_NOMBRE} ·{" "}
          {DatetimeUtil.formatFechaHoraCorta(f.at)}
        </span>
      ))}
    </div>
  );
};

export default SelloFirma;
