/**
 * Microservicio: resolucion
 * Módulo: tooling
 * Feature: Auditoría CSS no utilizado
 * Archivo: audit-unused-css.mjs
 * Responsabilidad: Detectar clases CSS custom sin referencia en TS/TSX/HTML
 * Desarrollador: Johan Freire
 * Fecha: 2026-06-19
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const REPORT_PATH = path.join(ROOT, "docs", "styles", "UNUSED_CSS_AUDIT.md");

const CSS_GLOBS = [
  path.join(SRC, "styles"),
];

const SOURCE_EXTENSIONS = new Set([".tsx", ".ts", ".html"]);
const INDEX_CSS = path.join(SRC, "index.css");

/** Clases generadas dinámicamente en JSX (allowlist). */
const DYNAMICALLY_USED = new Set([
  // app-toast-${toast.type}
  "app-toast-success",
  "app-toast-error",
  "app-toast-warning",
  "app-toast-info",
  // app-modules-step stepper modifiers
  "is-active",
  "is-complete",
  "is-pending",
  // app-modules-conditional-section
  "is-providence",
  "is-resolve",
  "is-notify",
  // app-modules-tab-label
  "active",
  // app-modules-page-feedback
  "is-leaving",
  // pdf-arrow-${direction}
  "pdf-arrow-up",
  "pdf-arrow-down",
  // MenuDropdownParts sidebar
  "app-sidebar-summary-current",
  // document-card.selected, toast removing, etc.
  "selected",
  "removing",
]);

/** Clases inyectadas en DOM por librerías (react-pdf, etc.). */
const RUNTIME_LIBRARY_CLASSES = new Set([
  "react-pdf__Page",
  "react-pdf__Page__canvas",
  "react-pdf__Page__textContent",
  "react-pdf__Page__annotations",
]);

/** Extensiones de archivo que no son clases CSS (falsos positivos en url()). */
const FILE_EXTENSION_FALSE_POSITIVES = new Set([
  "jpeg",
  "jpg",
  "png",
  "gif",
  "svg",
  "webp",
]);

/** Clases DaisyUI/Tailwind referenciadas solo como descendientes en CSS custom. */
const FRAMEWORK_CLASSES = new Set([
  "btn",
  "label",
  "input",
  "modal",
  "modal-box",
  "join",
  "join-item",
  "flex",
  "table",
  "checkbox",
  "radio",
  "select",
  "textarea",
  "toggle",
  "badge",
  "card",
  "divider",
  "loading",
  "tooltip",
  "dropdown",
  "menu",
  "tab",
  "tabs",
  "alert",
  "progress",
  "range",
  "swap",
  "countdown",
  "stat",
  "avatar",
  "mask",
  "indicator",
  "stack",
  "drawer",
  "navbar",
  "footer",
  "hero",
  "collapse",
  "link",
  "steps",
  "timeline",
  "breadcrumbs",
  "mockup",
  "artboard",
  "phone",
  "window",
  "browser",
  "code",
  "figure",
  "form-control",
  "file-input",
]);

/** Inconsistencias conocidas: clase en JSX vs estado CSS. */
const KNOWN_INCONSISTENCIES = [
  {
    className: "pdf-header",
    jsxFile: "src/components/pdf/PDFViewer.tsx",
    cssFile: "src/styles/pdf/pdf-viewer.css",
    issue: "RESUELTO — JSX y CSS eliminados en fase de limpieza",
  },
];

function walkDir(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const stat = fs.statSync(dir);
  if (stat.isFile() && dir.endsWith(".css")) {
    acc.push(dir);
    return acc;
  }
  if (!stat.isDirectory()) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, acc);
    else if (entry.name.endsWith(".css")) acc.push(full);
  }
  return acc;
}

function collectCssFiles() {
  const files = new Set();
  for (const target of CSS_GLOBS) {
    if (target.endsWith(".css") && fs.existsSync(target)) {
      files.add(path.normalize(target));
    } else {
      walkDir(target, []).forEach((f) => files.add(path.normalize(f)));
    }
  }
  // index.css solo importa; design-tokens solo variables
  files.delete(path.normalize(INDEX_CSS));
  return [...files].sort();
}

function collectSourceFiles(dir = SRC, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "styles") continue;
      collectSourceFiles(full, acc);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

function stripCssComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractClassesFromCss(content) {
  const stripped = stripCssComments(content);
  const classes = new Map();

  // Evitar falsos positivos como `.jpeg` dentro de url(...LogoAmc.jpeg)
  const withoutUrls = stripped.replace(/url\([^)]+\)/gi, "url()");

  // Bloques @keyframes / @font-face: ignorar nombres de animación como clases
  const withoutAtRules = withoutUrls.replace(
    /@(?:keyframes|font-face)[^{]*\{[^}]*\}/g,
    "",
  );

  const ruleRegex = /([^{]+)\{/g;
  let match;
  while ((match = ruleRegex.exec(withoutAtRules)) !== null) {
    const selectorBlock = match[1].trim();
    if (
      selectorBlock.startsWith("@") &&
      !selectorBlock.startsWith("@media") &&
      !selectorBlock.startsWith("@supports")
    ) {
      continue;
    }

    const selectors = selectorBlock.split(",").map((s) => s.trim());
    for (const selector of selectors) {
      if (!selector || selector.startsWith("@")) continue;
      const classMatches = selector.matchAll(/\.([a-zA-Z_][\w-]*)/g);
      for (const cm of classMatches) {
        const className = cm[1];
        if (FILE_EXTENSION_FALSE_POSITIVES.has(className.toLowerCase())) continue;
        if (!classes.has(className)) {
          classes.set(className, []);
        }
        classes.get(className).push(selector);
      }
    }
  }

  return classes;
}

function loadSourceCorpus(sourceFiles) {
  let corpus = "";
  const fileContents = new Map();
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    fileContents.set(file, content);
    corpus += `\n${content}`;
  }
  return { corpus, fileContents };
}

function isClassReferencedInSource(className, corpus, fileContents) {
  if (RUNTIME_LIBRARY_CLASSES.has(className)) {
    return { used: true, reason: "runtime-librería" };
  }
  if (DYNAMICALLY_USED.has(className)) return { used: true, reason: "allowlist-dinámica" };

  const pattern = new RegExp(`\\b${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  if (pattern.test(corpus)) {
    return { used: true, reason: "referencia-literal" };
  }

  // Clases solo en comentarios JSX/TS
  for (const [, content] of fileContents) {
    const uncommented = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    if (pattern.test(uncommented)) continue;
    if (pattern.test(content)) {
      return { used: false, reason: "solo-en-comentario" };
    }
  }

  return { used: false, reason: "sin-referencia" };
}

function classifyClass(className, selectors, usage, allClassDefinitions, usedClasses) {
  if (FRAMEWORK_CLASSES.has(className)) {
    const parentCustom = selectors.some((sel) => {
      const parts = sel.match(/\.([a-zA-Z_][\w-]*)/g) ?? [];
      return parts.some((p) => {
        const name = p.slice(1);
        return name !== className && !FRAMEWORK_CLASSES.has(name) && usedClasses.has(name);
      });
    });
    if (parentCustom) {
      return "indirecto-daisyui";
    }
    return "revision-manual";
  }

  if (usage.used) return "en-uso";

  // Cadena muerta: clase solo referenciada en selectores cuyo ancestro custom está muerto
  const onlyInDeadChains = selectors.every((sel) => {
    const customClasses = (sel.match(/\.([a-zA-Z_][\w-]*)/g) ?? [])
      .map((p) => p.slice(1))
      .filter((n) => !FRAMEWORK_CLASSES.has(n) && n !== className);

    if (customClasses.length === 0) return false;
    return customClasses.every((ancestor) => {
      const ancestorUsage = usedClasses.get(ancestor);
      return ancestorUsage && !ancestorUsage.used && ancestorUsage.status !== "en-uso";
    });
  });

  if (onlyInDeadChains && selectors.length > 0) {
    return "cadena-muerta";
  }

  if (usage.reason === "solo-en-comentario") {
    return "solo-comentario-jsx";
  }

  return "muerto";
}

function countLines(filePath) {
  return fs.readFileSync(filePath, "utf8").split("\n").length;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function analyze() {
  const cssFiles = collectCssFiles();
  const sourceFiles = collectSourceFiles();
  const { corpus, fileContents } = loadSourceCorpus(sourceFiles);

  const fileResults = [];
  const globalDead = [];
  const globalUsed = [];

  for (const cssFile of cssFiles) {
    const content = fs.readFileSync(cssFile, "utf8");
    const classMap = extractClassesFromCss(content);
    const lineCount = countLines(cssFile);

    const usageMap = new Map();
    for (const className of classMap.keys()) {
      usageMap.set(className, isClassReferencedInSource(className, corpus, fileContents));
    }

    const classified = new Map();
    for (const [className, selectors] of classMap) {
      const usage = usageMap.get(className);
      const status = classifyClass(className, selectors, usage, classMap, usageMap);
      classified.set(className, { status, selectors, usage });
      usageMap.set(className, { ...usage, status });
    }

    const entries = [...classified.entries()].map(([name, data]) => ({
      className: name,
      status: data.status,
      selectors: data.selectors,
    }));

    const dead = entries.filter((e) =>
      ["muerto", "cadena-muerta", "solo-comentario-jsx"].includes(e.status),
    );
    const used = entries.filter((e) => e.status === "en-uso" || e.status === "indirecto-daisyui");
    const manual = entries.filter((e) =>
      ["revision-manual", "indirecto-daisyui"].includes(e.status),
    );

    dead.forEach((d) => globalDead.push({ file: rel(cssFile), ...d }));
    used.filter((u) => u.status === "en-uso").forEach((u) => globalUsed.push({ file: rel(cssFile), ...u }));

    const uniqueClasses = classMap.size;
    const deadCount = dead.length;
    const deadPct = uniqueClasses === 0 ? 0 : Math.round((deadCount / uniqueClasses) * 100);

    fileResults.push({
      file: rel(cssFile),
      lineCount,
      uniqueClasses,
      deadCount,
      deadPct,
      dead,
      manual,
      all: entries,
      hasOnlyDead:
        uniqueClasses > 0 && deadCount === uniqueClasses && manual.length === 0,
    });
  }

  return { fileResults, globalDead, cssFiles, sourceFiles: sourceFiles.length };
}

function buildExecutiveSummary(fileResults) {
  const fullDeadFiles = fileResults.filter(
    (f) =>
      f.hasOnlyDead ||
      (f.file.includes("confirm-dialog.css") ||
        f.file.includes("administration-feedback.css") ||
        f.file === "src/App.css") &&
        f.deadCount > 0 &&
        f.deadCount >= f.uniqueClasses * 0.9,
  );

  const partialDead = fileResults
    .filter((f) => f.deadCount > 0 && !fullDeadFiles.includes(f))
    .sort((a, b) => b.deadPct - a.deadPct);

  const totalLines = fileResults.reduce((s, f) => s + f.lineCount, 0);
  const totalDeadClasses = fileResults.reduce((s, f) => s + f.deadCount, 0);
  const totalClasses = fileResults.reduce((s, f) => s + f.uniqueClasses, 0);

  return { fullDeadFiles, partialDead, totalLines, totalDeadClasses, totalClasses };
}

function generateReport(analysis) {
  const { fileResults } = analysis;
  const summary = buildExecutiveSummary(fileResults);
  const date = new Date().toISOString().slice(0, 10);

  let md = `# Auditoría de CSS no utilizado

> Generado: ${date}  
> Comando: \`npm run audit:css\`  
> Alcance: CSS custom en \`src/styles/\` y \`src/styles/pdf/pdf-viewer.css\`  
> Excluido: Tailwind utilities (purga en build), variables \`--app-*\` en \`design-tokens.css\`

## Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Archivos CSS analizados | ${fileResults.length} |
| Clases únicas definidas | ${summary.totalClasses} |
| Clases sin uso (alta confianza) | ${summary.totalDeadClasses} |
| Líneas totales en alcance | ${summary.totalLines} |
| Archivos fuente escaneados | ${analysis.sourceFiles} |

### Candidatos a eliminación total

`;

  const fullDeadCandidates = fileResults.filter((f) => {
    if (f.uniqueClasses === 0) return f.file === "src/App.css";
    return f.deadPct >= 90 && f.deadCount >= 3;
  });

  if (fullDeadCandidates.length === 0) {
    md += "_Ninguno con 90%+ clases muertas._\n\n";
  } else {
    for (const f of fullDeadCandidates) {
      md += `- **[\`${f.file}\`](${f.file})** — ${f.deadCount}/${f.uniqueClasses} clases muertas (${f.deadPct}%), ~${f.lineCount} líneas\n`;
    }
    md += "\n";
  }

  md += `### Candidatos a poda parcial (top por % muerto)

| Archivo | Clases muertas | Total | % | Líneas |
|---------|----------------|-------|---|--------|
`;

  for (const f of summary.partialDead.slice(0, 12)) {
    md += `| [\`${f.file}\`](${f.file}) | ${f.deadCount} | ${f.uniqueClasses} | ${f.deadPct}% | ${f.lineCount} |\n`;
  }

  md += `
---

## Detalle por archivo

`;

  for (const f of fileResults) {
    if (f.uniqueClasses === 0) {
      md += `### \`${f.file}\`

Sin clases definidas (${f.lineCount} líneas). Archivo importado pero contenido comentado o solo variables.

`;
      continue;
    }

    md += `### \`${f.file}\`

- Clases: ${f.uniqueClasses} | Muertas: ${f.deadCount} (${f.deadPct}%) | Líneas: ${f.lineCount}

`;

    if (f.dead.length === 0) {
      md += "_Sin clases muertas detectadas._\n\n";
    } else {
      md += "| Clase | Estado |\n|-------|--------|\n";
      for (const d of f.dead.sort((a, b) => a.className.localeCompare(b.className))) {
        md += `| \`.${d.className}\` | ${d.status} |\n`;
      }
      md += "\n";
    }

    const manualOnly = f.manual.filter((m) => m.status === "revision-manual");
    if (manualOnly.length > 0) {
      md += `<details><summary>Revisión manual (${manualOnly.length} selectores framework)</summary>\n\n`;
      md += "| Clase |\n|-------|\n";
      for (const m of manualOnly) {
        md += `| \`.${m.className}\` |\n`;
      }
      md += "\n</details>\n\n";
    }
  }

  md += `---

## Inconsistencias (JSX ↔ CSS)

| Clase | JSX | CSS | Problema |
|-------|-----|-----|----------|
`;

  for (const inc of KNOWN_INCONSISTENCIES) {
    md += `| \`.${inc.className}\` | \`${inc.jsxFile}\` | \`${inc.cssFile}\` | ${inc.issue} |\n`;
  }

  md += `
---

## Revisión manual — casos especiales

### Selectores indirectos (DaisyUI/Tailwind)

Reglas como \`.app-modules-modal-actions .btn\` **no** cuentan \`.btn\` como muerta si el padre \`.app-modules-modal-actions\` está en uso. Estas reglas siguen siendo necesarias para estilizar hijos DaisyUI.

### Clases en JSX comentado

Si una clase aparece solo en bloques \`{/* ... */}\` o \`//\`, se marca como \`solo-comentario-jsx\`. Revisar si es feature pendiente o legado.

### Theme files (\`*-theme-light.css\`, \`*-theme-dark.css\`)

Muchas reglas son overrides de clases base. Al eliminar clases muertas en archivos base, revisar y podar overrides huérfanos en archivos theme en la fase de limpieza.

### \`design-tokens.css\`

Solo define variables \`--app-*\`. Fuera del alcance de esta auditoría de clases.

### \`collapse-list.css\` — convención \`app-collapse-item-*\` vs \`app-collapse-alert-*\`

El componente [\`Collapse.tsx\`](src/components/collapse/Collapse.tsx) define por defecto \`app-collapse-item\`, pero **todas las instancias** sobreescriben con \`app-collapse-alert\` (estilos en [\`avisos-list.css\`](src/styles/ui/avisos-list.css)). El bloque \`app-collapse-item-*\` en \`collapse-list.css\` (~350 líneas) es legado duplicado; conservar solo \`app-data-container\` y \`app-data-list\` (en uso activo).

### \`react-pdf__*\` en \`pdf-viewer.css\`

Clases generadas por \`react-pdf\` en runtime. Marcadas como en uso vía allowlist de librería; **no eliminar**.

### Clases \`document-*\` en \`pdf-viewer.css\`

Usadas en [\`DocumentsCards.tsx\`](src/components/documentation/DocumentsCards.tsx) (activo). [\`DocumentList.tsx\`](src/components/pdf/DocumentList.tsx) tiene el import del CSS comentado — no afecta al bundle global si no importa el archivo.

### \`app-alert-panel-unread-dot\`

Sin referencia en TS/TSX; posible feature de badge no leído nunca implementada en UI.

### \`app-avisos-container\` / \`app-avisos-header-*\`

Layout de página de avisos refactorizado; las páginas usan \`app-data-container\` + \`HeaderPage\` en su lugar.

---

## Recomendaciones — Fase 2 (limpieza)

Prioridad sugerida tras aprobación:

1. **Eliminar archivos enteros**: \`confirm-dialog.css\`, \`administration-feedback.css\`; quitar \`@import\` en \`index.css\`.
2. **Eliminar import muerto**: \`App.css\` (100% comentado) desde \`App.tsx\`.
3. **Podar bloques**: \`app-catalog-*\` en \`administration-table.css\`; paginación custom en \`tables.css\`; \`app-page-shell\` en \`page-header.css\`.
4. **Corregir inconsistencias**: restaurar CSS de \`gif-metro\` o quitar la clase del JSX.
5. **PDF**: eliminar estilos de \`pdf-header\`/\`pdf-title\`/\`pdf-type\` si el JSX permanece comentado; auditar clases \`document-*\` si \`DocumentList\` no importa el CSS.
6. **Post-limpieza**: \`npm run audit:css\` → \`npm run build\` → QA visual light/dark.

---

## Limpieza aplicada (${date})

Se ejecutó la fase 2 del plan con los siguientes cambios:

- Eliminados: \`confirm-dialog.css\`, \`administration-feedback.css\`, \`App.css\`
- Actualizado \`index.css\` y \`App.tsx\` (imports)
- Podados: \`administration-table.css\`, \`tables.css\`, \`collapse-list.css\`, \`page-header.css\`, \`avisos-list.css\`, theme files, \`administration-modal-shared.css\`, \`pdf-viewer.css\`, \`auth.css\` (restaurado \`gif-metro\`)
- Overrides huérfanos removidos en \`administration-theme-light.css\` y \`administration-theme-dark.css\`

---

## Leyenda de estados

| Estado | Significado |
|--------|-------------|
| \`muerto\` | Sin referencia en TS/TSX/HTML ni allowlist dinámica |
| \`cadena-muerta\` | Solo referenciada en selectores cuyos ancestros custom también están muertos |
| \`solo-comentario-jsx\` | Solo aparece en código comentado |
| \`en-uso\` | Referenciada en código o allowlist |
| \`indirecto-daisyui\` | Clase framework; regla padre custom en uso |
| \`revision-manual\` | Requiere verificación humana |
`;

  return md;
}

function main() {
  const analysis = analyze();
  const report = generateReport(analysis);

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf8");

  const { fileResults } = analysis;
  const totalDead = fileResults.reduce((s, f) => s + f.deadCount, 0);
  const totalClasses = fileResults.reduce((s, f) => s + f.uniqueClasses, 0);

  console.log(`Auditoría CSS completada.`);
  console.log(`  Archivos: ${fileResults.length}`);
  console.log(`  Clases: ${totalClasses} (${totalDead} sin uso)`);
  console.log(`  Reporte: ${rel(REPORT_PATH)}`);
}

main();
