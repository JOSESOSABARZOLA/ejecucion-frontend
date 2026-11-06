/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Resolución subm_path -> ruta de la IA corregida (D-03) — unidad de datos
 * Archivo: menuRoutes.test.ts
 * Responsabilidad: Aseverar que CADA subm_path del submenú corregido (Plan 01) resuelve a una ruta
 *   registrada como hija de '/home' en routes.tsx — no hay subm_path huérfano. Es una unidad de datos:
 *   inspecciona el array `routes` (lee el campo `path` de cada hijo), NO renderiza React ni monta lazy.
 *   Si en el futuro se agrega/renombra una bandeja, este test falla y obliga a re-alinear IA<->rutas.
 *   Desde la Fase 03.11 / Plan 05 asevera además la topología de auth: la ruta de retorno del portal
 *   es de NIVEL SUPERIOR (queda fuera del guard, porque cuando se monta todavía no hay sesión) y los
 *   6 subm_path siguen resolviendo como hijos de '/home' — la regresión de que el guard no rompió la IA.
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 * Modificado por: Andrés Miño — 2026-09-21 (Fase 03.19, Plan 11, D-12: la coherencia de la ruta de
 *   la página de generación de documentos, que se declara un plan antes de registrarse.)
 * Modificado por: Andrés Miño — 2026-09-24 (Fase 03.22, Plan 04, D-01: la bandeja APARTE de órdenes
 *   de pago se retira. `/home/ordenes-pago` sale de la lista de esperados EN EL MISMO COMMIT que
 *   retira la ruta, y entra la aseveración INVERSA: que esa ruta ya no está registrada. Este archivo
 *   vuelve a aseverar 6 subm_path, los mismos de antes del 2026-09-03.)
 * Modificado por: Andrés Miño — 2026-09-28 (Fase 03.20, Plan 07: entra el Gestor de Notificaciones y
 *   los esperados pasan a SIETE. La ruta se añade aquí EN EL MISMO COMMIT que la registra en
 *   `routes.tsx` y que la declara en `navigation.ts` — es lo que el precedente de la 03.22 demostró
 *   que no se puede dejar para después: tres sitios que no pueden separarse, y una ruta en el menú
 *   sin ruta en el enrutador es una entrada muerta; al revés, una pantalla inalcanzable.)
 * Modificado por: Andrés Miño — 2026-10-02 (quick 261002-lds: entra el panel de «Jerarquia» y los
 *   esperados pasan a OCHO. La ruta se añade aquí EN EL MISMO COMMIT que la registra en
 *   `routes.tsx`, como exige el precedente de la 03.22 — dejarlo para después es exactamente cómo
 *   se cuela la letra de diferencia que manda al usuario al comodín `*`.)
 * Modificado por: Andrés Miño — 2026-10-14 (quick 261014-kn3: la vuelta de la generación deja de
 *   ser fija. Se asevera la ruta de entrada con origen, que la vuelta de la obligación de hacer es
 *   una ruta registrada y que todo valor fuera de la lista cerrada cae en la bandeja.)
 */

import { describe, it, expect } from "vitest";
import type { RouteObject } from "react-router-dom";
import { routes } from "./routes";
import {
  RUTA_GENERAR_DOCUMENTO,
  RUTA_GENERAR_DOCUMENTO_DESDE,
  RUTA_GENERAR_DOCUMENTO_HIJA,
  RUTA_VUELTA_GENERACION,
  resolverVueltaGeneracion,
} from "./rutasGeneracionDocumento";
import {
  RUTA_OBLIGACION_HACER,
  RUTA_OBLIGACION_HACER_HIJA,
} from "./rutasObligacionHacer";
import {
  RUTA_GESTION_NOTIFICACIONES,
  RUTA_GESTION_NOTIFICACIONES_HIJA,
} from "./rutasGestionNotificaciones";

/**
 * subm_path ESPERADOS de la IA corregida (Plan 01). Cada uno debe resolver a un hijo de '/home'.
 *
 * Nota post-3.8: `/home/entrada` resuelve a la Bandeja de Entrada REAL (`BandejaEntradaPage`, Plan 04),
 * NO al `PlaceholderPage`. Como esta es una unidad de DATOS (solo lee el campo `path`, no monta el
 * componente lazy), la identidad del componente `entrada` -> BandejaEntradaPage se valida por `tsc`/build
 * (Plan 04) y en el checkpoint E2E (Plan 06), no aquí. La entrada por memorando quedó reemplazada por
 * esta ruta; ver MEMORANDO-RETIREMENT-3.8.md §"Estado post-3.8".
 *
 * 🔴 ESTA LISTA SE ESCRIBE A MANO, Y ES DELIBERADO — es la única lista de este repositorio que lo
 * hace. No es el registro de rutas del enrutador: es el ESPEJO de lo que la base siembra en
 * `t_submenus`, transcrito aquí de forma independiente. Poner la constante de la ruta en su lugar
 * volvería la aseveración TAUTOLÓGICA: `routes.tsx` registra esa misma constante, así que el test
 * pasaría con cualquier cadena, incluida una que no coincida con la sembrada — que es justamente el
 * fallo que este archivo existe para impedir. Los dos lados se atan con la aseveración de más abajo,
 * que exige que el literal de aquí y la constante del enrutador sean el mismo valor.
 */
const EXPECTED_SUBM_PATHS = [
  "/home/entrada",
  "/home/salida",
  "/home/actas",
  "/home/aprobacion-sorteo",
  "/home/sorteo",
  "/home/mis-asignados",
  // Fase 03.20, Plan 07 — el Gestor de Notificaciones. Sembrado como submenú 10 por
  // `ejecucion-db/migrations/2026-09-25-menu-gestion-notificaciones.sql`, bajo el módulo 5
  // «Seguimiento y Control», con grants a los roles 2 y 3.
  "/home/gestion-notificaciones",
  // Quick 261002-lds — el panel de jerarquía. Sembrado como submenú 11 por
  // `ejecucion-db/migrations/2026-10-02-menu-jerarquia.sql`, bajo el módulo 4 «Administracion»,
  // con UN solo grant: el rol 1 (administrador).
  "/home/jerarquia",
] as const;

/**
 * ⚠️ `/home/parametros` SIGUE FUERA DE ESTA LISTA, y el 8 de abajo NO se lee como «todos los
 * submenús sembrados». Es un hueco PREEXISTENTE: esa ruta está sembrada en `t_submenus` (submenú
 * 7, mismo módulo 4 que el panel nuevo) y registrada en `routes.tsx` desde la Fase 03.13, pero
 * nunca entró aquí. Queda fuera del alcance del quick 261002-lds, anotado para que nadie cuente
 * los esperados y concluya que la lista está completa.
 */

/**
 * La ruta RETIRADA por la Fase 03.22 / Plan 04 (D-01). Vivió entre el 2026-09-03 y el 2026-09-24.
 *
 * 🔴 ESTÁ AQUÍ PARA QUE UN REINTRODUCIR ACCIDENTAL SE VEA. Sin esta constante, volver a registrar
 * la bandeja aparte no rompería nada: la lista de arriba solo comprueba que lo esperado EXISTE, no
 * que lo retirado siga fuera. Ésta es la aseveración inversa de la de arriba.
 *
 * ⚠️ LO QUE ESTO NO COMPRUEBA: quién ve la entrada en el menú. El menú lateral es data-driven y lo
 * decide el GRANT de la base (`t_rol_actividad` → `t_actividad` → `t_submenus` → `usu_get_user`),
 * no este archivo; su gate vive en `ejecucion-db/scripts/assert-menu-role-matrix.sql`, que asevera
 * el conjunto exacto de submenús por rol. Aquí solo se afirma la TOPOLOGÍA del enrutador.
 */
const RUTA_RETIRADA_ORDENES_PAGO = "/home/ordenes-pago";

/**
 * La bandeja de solicitudes de sello de clausura, RETIRADA el 2026-10-08 por pedido del área
 * (vivió desde la Fase 03.18). Mismo propósito que la constante de arriba: que reintroducirla por
 * accidente rompa un test. Su grant lo retira `2026-10-08-retiro-menu-solicitudes-sello.sql`.
 */
const RUTA_RETIRADA_SOLICITUDES_SELLO = "/home/solicitudes-sello";

/**
 * Extrae el conjunto de rutas registradas como hijas de '/home', normalizadas a '/home/<path>'.
 * No renderiza nada: solo lee el campo `path` de cada RouteObject hijo.
 */
function registeredHomePaths(routeTree: RouteObject[]): Set<string> {
  const home = routeTree.find((r) => r.path === "/home");
  const children = home?.children ?? [];
  const paths = new Set<string>();
  for (const child of children) {
    if (typeof child.path === "string" && child.path.length > 0) {
      paths.add(`/home/${child.path}`);
    }
  }
  return paths;
}

describe("resolución subm_path -> ruta (D-03)", () => {
  const registered = registeredHomePaths(routes);

  it("existe la ruta padre '/home' con hijos", () => {
    expect(registered.size).toBeGreaterThan(0);
  });

  it.each(EXPECTED_SUBM_PATHS)(
    "el subm_path %s está registrado como hijo de /home (no huérfano)",
    (submPath) => {
      expect(registered.has(submPath)).toBe(true);
    },
  );

  it("los 8 subm_path esperados resuelven todos (ninguno huérfano)", () => {
    // OCHO desde el quick 261002-lds: seis bandejas de sorteo, el Gestor de Notificaciones y el
    // panel de Jerarquía. Fueron 7 entre el 2026-09-28 y el 2026-10-02, 6 entre el 2026-09-24 y el
    // 2026-09-28, y 7 entre el 2026-09-03 y el 2026-09-24 con la bandeja aparte de órdenes de pago,
    // que se retiró.
    // ⚠️ OCHO no es «todos los submenús sembrados»: ver la nota de `/home/parametros` arriba.
    const orphans = EXPECTED_SUBM_PATHS.filter((p) => !registered.has(p));
    expect(orphans).toEqual([]);
    expect(EXPECTED_SUBM_PATHS).toHaveLength(8);
  });

  it("la bandeja retirada por la Fase 03.22 NO está registrada como hija de /home", () => {
    expect(registered.has(RUTA_RETIRADA_ORDENES_PAGO)).toBe(false);
  });

  it("la bandeja de solicitudes de sello retirada NO está registrada como hija de /home", () => {
    expect(registered.has(RUTA_RETIRADA_SOLICITUDES_SELLO)).toBe(false);
    expect(EXPECTED_SUBM_PATHS).not.toContain(RUTA_RETIRADA_SOLICITUDES_SELLO);
  });

  it("la ruta retirada tampoco figura entre los subm_path esperados", () => {
    // Las dos listas tienen que seguir siendo disjuntas: si alguien devolviera la ruta a
    // EXPECTED_SUBM_PATHS sin devolver el grant, la aseveración de arriba fallaría por el motivo
    // equivocado y costaría entender cuál de los dos lados se movió.
    expect(EXPECTED_SUBM_PATHS).not.toContain(RUTA_RETIRADA_ORDENES_PAGO);
  });
});

/** Ruta de retorno del portal de Auth central; debe coincidir con la de `authRuntimeConfig`. */
const AUTH_CALLBACK_PATH = "/auth/callback";

describe("topología de auth en el árbol de rutas (Fase 03.11 / Plan 05)", () => {
  it("la ruta de retorno del portal existe como ruta de NIVEL SUPERIOR", () => {
    expect(routes.some((r) => r.path === AUTH_CALLBACK_PATH)).toBe(true);
  });

  it("la ruta de retorno del portal NO es hija de '/home' (queda fuera del guard)", () => {
    const home = routes.find((r) => r.path === "/home");
    const children = home?.children ?? [];

    expect(
      children.some(
        (child) =>
          child.path === AUTH_CALLBACK_PATH ||
          child.path === AUTH_CALLBACK_PATH.slice(1),
      ),
    ).toBe(false);
    expect(registeredHomePaths(routes).has(`/home${AUTH_CALLBACK_PATH}`)).toBe(
      false,
    );
  });

  it("'/home' declara una ruta índice para que el Outlet no quede vacío", () => {
    const home = routes.find((r) => r.path === "/home");

    expect((home?.children ?? []).some((child) => child.index === true)).toBe(
      true,
    );
  });

  it("existe una ruta comodín de último recurso", () => {
    expect(routes.some((r) => r.path === "*")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RUTA DE LA PÁGINA DE GENERACIÓN (Fase 03.19, Plan 11 — D-12)
//
// 🔴 ES LA PRUEBA BARATA QUE IMPIDE LA LETRA DE DIFERENCIA. La entrada «Generar documento» del `⋮`
// NAVEGA: no abre un modal. Si la ruta a la que navega y la que `routes.tsx` registra se separan
// en un carácter, el enlace cae en el comodín `*` y el decisor acaba en la raíz sin que nada haya
// fallado de forma visible — ni el compilador ni la suite dirían una palabra. Aquí se comprueba
// que las tres formas de la ruta (la de vuelta, la hija y la absoluta) se derivan de la misma raíz.
//
// 🔴 NINGUNA DE ESTAS ASEVERACIONES ESCRIBE EL SEGMENTO A MANO, Y ES DELIBERADO. Todo sale de
// `rutasGeneracionDocumento.ts`: escribirlo aquí crearía el segundo sitio donde teclearlo mal, que
// es exactamente lo que el archivo de rutas existe para impedir.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** El parámetro de expediente de la ruta hija, tal y como lo escribe react-router. */
const PARAMETRO_EXPEDIENTE = "/:eejeId";

describe("coherencia de la ruta de generación de documentos (D-12)", () => {
  /** La ruta hija sin su parámetro: `mis-asignados/<segmento>`. */
  const hijaSinParametro = RUTA_GENERAR_DOCUMENTO_HIJA.slice(
    0,
    -PARAMETRO_EXPEDIENTE.length,
  );

  it("la ruta hija termina en el parámetro de expediente (la página exige uno)", () => {
    // Por esto la página NO tiene submenú y no hay migración SQL que sembrar: una entrada de menú
    // lateral apuntando aquí sería una entrada que no se puede pulsar.
    expect(RUTA_GENERAR_DOCUMENTO_HIJA.endsWith(PARAMETRO_EXPEDIENTE)).toBe(
      true,
    );
    expect(RUTA_GENERAR_DOCUMENTO_HIJA.startsWith("/")).toBe(false);
  });

  it("la ruta absoluta empieza por la bandeja y termina en el identificador", () => {
    const ruta = RUTA_GENERAR_DOCUMENTO(4821);

    expect(ruta.startsWith(`${RUTA_VUELTA_GENERACION}/`)).toBe(true);
    expect(ruta.endsWith("/4821")).toBe(true);
  });

  it("la ruta absoluta contiene el segmento de la ruta hija sin su parámetro", () => {
    // Es la comprobación que ata las dos formas: si alguien cambiara una y no la otra, la ruta
    // registrada y la ruta navegada dejarían de ser la misma y esto fallaría.
    expect(RUTA_GENERAR_DOCUMENTO(7)).toBe(`/home/${hijaSinParametro}/7`);
  });

  it("la ruta de vuelta es la bandeja del decisor, registrada como hija de /home", () => {
    expect(registeredHomePaths(routes).has(RUTA_VUELTA_GENERACION)).toBe(true);
  });

  it("no hay gemela escrita a mano de la ruta de generación en el enrutador", () => {
    // El plan 11 NO registra la ruta —lo hace el plan 16, dueño de `routes.tsx` y de la página—,
    // así que hoy este conjunto está vacío. Cuando el 16 la registre, esta aseveración exige que lo
    // haga CON la constante: cualquier cadena escrita a mano que empiece por el mismo segmento
    // delataría la letra de diferencia el día en que se introdujera.
    const home = routes.find((r) => r.path === "/home");
    const conSegmento = (home?.children ?? [])
      .map((hijo) => hijo.path)
      .filter(
        (ruta): ruta is string =>
          typeof ruta === "string" && ruta.startsWith(hijaSinParametro),
      );

    expect(conSegmento.every((ruta) => ruta === RUTA_GENERAR_DOCUMENTO_HIJA))
      .toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA VUELTA DE LA GENERACIÓN (quick 261014-kn3)
//
// Desde este quick la página de generación tiene dos puertas: el `⋮` de la bandeja y «Generar
// providencia» de la ficha de la obligación de hacer. El origen viaja como CLAVE en la query y la
// página construye la vuelta con una constante: aquí se asevera que esa vuelta es una ruta
// registrada, que sin origen todo sigue como antes, y que ningún valor ajeno a la lista cerrada
// —una URL, un path, una clave heredada de `Object.prototype`— produce otra cosa que la bandeja.
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("la vuelta de la generación (quick 261014-kn3)", () => {
  const hijaSinParametro = RUTA_GENERAR_DOCUMENTO_HIJA.slice(
    0,
    -PARAMETRO_EXPEDIENTE.length,
  );

  it("la ruta «desde» es la absoluta más el parámetro, y su path sigue siendo la hija registrada", () => {
    const ruta = RUTA_GENERAR_DOCUMENTO_DESDE(4821, "obligacion-hacer");

    expect(ruta).toBe(`${RUTA_GENERAR_DOCUMENTO(4821)}?desde=obligacion-hacer`);
    expect(ruta.split("?")[0]).toBe(`/home/${hijaSinParametro}/4821`);
  });

  it("la vuelta de la obligación de hacer es su ficha, y esa ruta está registrada", () => {
    const vuelta = resolverVueltaGeneracion(4821, "?desde=obligacion-hacer");

    expect(vuelta).toEqual({
      ruta: RUTA_OBLIGACION_HACER(4821),
      rotulo: "Volver a la obligación de hacer",
      miga: "Obligación de hacer",
    });
    expect(vuelta.ruta).toBe("/home/obligacion-hacer/4821");
    expect(
      registeredHomePaths(routes).has(`/home/${RUTA_OBLIGACION_HACER_HIJA}`),
    ).toBe(true);
  });

  it("sin parámetro la vuelta es la de siempre: la bandeja, con su rótulo y su miga", () => {
    expect(resolverVueltaGeneracion(4821, "")).toEqual({
      ruta: RUTA_VUELTA_GENERACION,
      rotulo: "Volver a Mis Expedientes",
      miga: "Mis Expedientes",
    });
  });

  it.each([
    ["una URL absoluta", 4821, "?desde=https://malicioso.example"],
    ["una protocol-relative", 4821, "?desde=//malicioso.example"],
    ["un path cualquiera", 4821, "?desde=/home/otra-cosa"],
    ["constructor", 4821, "?desde=constructor"],
    ["__proto__", 4821, "?desde=__proto__"],
    ["un origen vacío", 4821, "?desde="],
    ["otro parámetro", 4821, "?volver=https://malicioso.example"],
    ["un eejeId NaN", Number.NaN, "?desde=obligacion-hacer"],
    ["un eejeId 0", 0, "?desde=obligacion-hacer"],
    ["un eejeId negativo", -3, "?desde=obligacion-hacer"],
    ["un eejeId no entero", 1.5, "?desde=obligacion-hacer"],
  ])("🔴 %s cae en la vuelta por defecto", (_caso, eejeId, search) => {
    const vuelta = resolverVueltaGeneracion(eejeId, search);

    expect(vuelta.ruta).toBe(RUTA_VUELTA_GENERACION);
    expect(vuelta.rotulo).toBe("Volver a Mis Expedientes");
    expect(vuelta.ruta).not.toContain("//");
    expect(vuelta.ruta).not.toContain("://");
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RUTA DEL GESTOR DE NOTIFICACIONES (Fase 03.20, Plan 07)
//
// 🔴 TRES SITIOS QUE NO SE PUEDEN SEPARAR: `rutasGestionNotificaciones.ts` (el único literal),
// `routes.tsx` (la ruta hija con su guardia) y `navigation.ts` (el contrato de la entrada de menú).
// Una entrada en navegación sin ruta en el enrutador es un enlace de menú MUERTO; una ruta sin
// entrada es una pantalla a la que no se llega. Y por encima de las tres está la migración: el menú
// real lo arma `usu_get_user` con lo sembrado en `t_submenus`, y el sidebar navega a ese `subm_path`.
//
// Lo que se afirma aquí es la CORRESPONDENCIA, no la prosa: que el literal espejo de la migración y
// la constante que registra el enrutador son el mismo valor, y que nadie ha colado una gemela
// escrita a mano. Lo que NO se afirma es quién ve la entrada: eso lo decide el GRANT de la base, y
// su puerta es `ejecucion-db/scripts/assert-menu-role-matrix.sql`.
// ═════════════════════════════════════════════════════════════════════════════════════════════

describe("coherencia de la ruta del Gestor de Notificaciones (Fase 03.20)", () => {
  it("la ruta absoluta se deriva de la hija, y la hija no lleva barra inicial", () => {
    expect(RUTA_GESTION_NOTIFICACIONES).toBe(
      `/home/${RUTA_GESTION_NOTIFICACIONES_HIJA}`,
    );
    expect(RUTA_GESTION_NOTIFICACIONES_HIJA.startsWith("/")).toBe(false);
  });

  it("🔴 el literal espejo de la migración y la constante del enrutador son el MISMO valor", () => {
    // Es la aseveración que ata los dos lados y la que evita que la lista de esperados sea
    // tautológica: el literal de `EXPECTED_SUBM_PATHS` se transcribe del `subm_path` sembrado, y la
    // constante es la que `routes.tsx` registra. Si alguien cambiara una y no la otra —una letra
    // basta—, el menú aparecería y su enlace caería en el comodín `*`, devolviendo al usuario a la
    // raíz sin que nada pareciera haber fallado.
    expect(EXPECTED_SUBM_PATHS).toContain(RUTA_GESTION_NOTIFICACIONES);
  });

  it("la ruta está registrada como hija de /home, con la constante", () => {
    expect(registeredHomePaths(routes).has(RUTA_GESTION_NOTIFICACIONES)).toBe(
      true,
    );
  });

  it("no hay gemela escrita a mano de la ruta del Gestor en el enrutador", () => {
    // Cualquier hija de `/home` que empiece por este segmento tiene que ser EXACTAMENTE la
    // constante. Es lo que delataría el día en que alguien registrara la cadena a mano —con o sin
    // una letra de diferencia— en vez de importarla.
    const home = routes.find((r) => r.path === "/home");
    const conSegmento = (home?.children ?? [])
      .map((hijo) => hijo.path)
      .filter(
        (ruta): ruta is string =>
          typeof ruta === "string" &&
          ruta.startsWith(RUTA_GESTION_NOTIFICACIONES_HIJA),
      );

    expect(conSegmento).toEqual([RUTA_GESTION_NOTIFICACIONES_HIJA]);
  });
});
