/**
 * Microservicio: ejecucion
 * Módulo: ejecucion/providencias (frontend)
 * Feature: Basarse en un documento anterior (Fase 03.19, Plan 15 · D-04)
 * Archivo: similarDocumentImport.util.ts
 * Responsabilidad: Convertir el contenido ALMACENADO de una providencia anterior en algo que el
 *   editor del paso 2 pueda recibir tal cual — sin degradarlo por el camino.
 *
 *   Portado casi verbatim de `resolucion-frontend @ origin/dev`
 *   (`…/document-generation/lib/similarDocumentImport.util.ts`, 78 líneas). Se tradujeron los
 *   imports y la fuente —allí las secciones llegan como un objeto plano, aquí como el array
 *   `docStructure.secciones[]` que define el plan 05—, y se añadió la comprobación de versión. La
 *   conducta central es la misma y es la razón de portarlo.
 *
 *   ── 🔴 ES EXACTAMENTE LO CONTRARIO DE DEGRADAR HTML A TEXTO ─────────────────────────────────
 *   `toEditorHtml` NO toca lo que ya viene marcado: si el valor trae etiquetas, se devuelve
 *   IDÉNTICO, byte por byte. Solo envuelve en párrafos lo que llega como texto plano, porque el
 *   editor colapsa los saltos de línea sueltos y el documento importado aparecería como un único
 *   bloque.
 *
 *   Por qué importa tanto: el richtext de Ejecución viaja como HTML hasta el backend, y allí lo
 *   traduce a nodos de PDF el conversor `richtext-a-pdfmake` — esas etiquetas son su ENTRADA, no un
 *   adorno del navegador. Cualquier pieza que las quitara aquí emitiría actos administrativos sin
 *   negrita, sin títulos y sin listas, y el decisor vería su propio texto en pantalla sin entender
 *   por qué el PDF sale plano. Es la regresión que costó las fases 03.14 y 03.15, y por eso una de
 *   las guardas de arquitectura de esta fase (`npm run guard:arquitectura`, guarda B) falla si
 *   entra al repo una pieza que degrade HTML a texto. Esta utilidad entra por la puerta contraria:
 *   hay una prueba de IGUALDAD ESTRICTA que lo sostiene.
 *
 *   ── LA VERSIÓN SE MIRA ANTES DE IMPORTAR ────────────────────────────────────────────────────
 *   El plan 05 grabó `version: 1` dentro del contenido almacenado precisamente para que este lado
 *   pudiera distinguir un contenido que entiende de uno que no, en vez de adivinarlo por las claves
 *   que encuentre. Una versión desconocida NO se importa: se devuelve vacío y la pantalla lo dice.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-09-22
 */

import type { ProvidenciaDocStructure } from "../services/ProvidenciaService";

/**
 * Versión del contenido almacenado que este cliente sabe leer.
 *
 * ⚠️ Espeja `version` de `ProvidenciaDocStructure` en
 * `ejecucion-backend/…/providencias/interfaces/providencia.interface.ts`. Subirla aquí sin leer qué
 * cambió al otro lado es justo lo que la comprobación existe para impedir.
 */
export const VERSION_CONTENIDO_SOPORTADA = 1;

/**
 * ¿El valor ya viene marcado como HTML?
 *
 * Deliberadamente laxo, igual que en el original: ante la duda se prefiere RESPETAR el valor a
 * reescribirlo. El coste de equivocarse en un sentido es un párrafo de menos; en el otro, un acto
 * administrativo sin formato.
 */
const PATRON_ETIQUETA_HTML = /<\/?[a-z][\s\S]*>/i;

/**
 * Deja un valor almacenado listo para el editor.
 *
 * - Ya es HTML ⇒ se devuelve **idéntico**.
 * - Es texto plano ⇒ cada bloque separado por línea en blanco se envuelve en su párrafo.
 * - Está vacío ⇒ cadena vacía, y **no** un `<p></p>` huérfano: un párrafo vacío cuenta como
 *   contenido para el editor y haría que el paso 2 pidiera confirmación para reemplazar un cuerpo
 *   que en realidad está en blanco.
 */
export const toEditorHtml = (value: string): string => {
  const recortado = value.trim();
  if (!recortado) {
    return "";
  }

  if (PATRON_ETIQUETA_HTML.test(recortado)) {
    return recortado;
  }

  return recortado
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean)
    .map((parrafo) => `<p>${parrafo}</p>`)
    .join("");
};

/**
 * ¿Se puede importar este contenido almacenado? Falso si no hay contenido, si no trae secciones o
 * si la versión no es la que este cliente sabe leer.
 */
export const esContenidoImportable = (
  estructura: ProvidenciaDocStructure | undefined,
): boolean =>
  !!estructura &&
  estructura.version === VERSION_CONTENIDO_SOPORTADA &&
  Array.isArray(estructura.secciones);

/**
 * Saca del contenido almacenado las secciones que este módulo sabe colocar, ya listas para el
 * editor.
 *
 * @param estructura lo que devolvió `GET /providencias/similares` en `docStructure`.
 * @param claves las secciones que el compositor conoce. Hoy es una sola —el cuerpo—, y se pasa
 *   desde fuera para que el día que haya más no haya que tocar esta utilidad.
 * @returns un mapa clave → HTML. **Solo con las que traen contenido**: una sección en blanco no
 *   entra, porque importarla en blanco borraría lo que el decisor ya hubiera escrito ahí.
 */
export const importarSeccionesDeProvidencia = (
  estructura: ProvidenciaDocStructure | undefined,
  claves: readonly string[],
): Record<string, string> => {
  if (!esContenidoImportable(estructura)) {
    return {};
  }

  const porClave = new Map<string, string>();
  for (const seccion of estructura!.secciones) {
    porClave.set(seccion.clave, seccion.html ?? "");
  }

  const importadas: Record<string, string> = {};
  for (const clave of claves) {
    const crudo = porClave.get(clave) ?? "";
    if (crudo.trim().length > 0) {
      importadas[clave] = toEditorHtml(crudo);
    }
  }

  return importadas;
};

/**
 * Funde lo importado sobre lo que ya había. Lo importado pisa su propia clave y **no toca las
 * demás**; devuelve un objeto nuevo, sin mutar el que recibe.
 */
export const fusionarSeccionesImportadas = (
  actual: Record<string, string>,
  importadas: Record<string, string>,
): Record<string, string> => ({
  ...actual,
  ...importadas,
});
