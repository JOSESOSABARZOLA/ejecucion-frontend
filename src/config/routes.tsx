/**
 * Microservicio: ejecucion
 * Módulo: App Shell
 * Feature: Configuración de rutas (Ejecución / DME)
 * Archivo: routes.tsx
 * Responsabilidad: Gestionar las rutas de la aplicación. Las rutas de documentación y
 *   notificaciones del clon se RETIRARON (2026-08-20): su backend no existe en Ejecución.
 *   Desde la Fase 03.11 / Plan 05 es también el ÚNICO punto de control de acceso: todo el subárbol
 *   privado `/home/*` cuelga de un `AuthGuard`, la ruta de retorno del portal (`/auth/callback`) es
 *   de nivel superior y queda FUERA del guard —cuando se monta todavía no hay sesión—, y la raíz
 *   decide qué mostrar según el modo de autenticación. El formulario de acceso local se declara bajo
 *   la bandera de desarrollo de Vite, que `vite build` sustituye por un literal falso: la rama y su
 *   import dinámico desaparecen del bundle desplegado (garantía estructural de D-02).
 * Desarrollador: Andrés Miño
 * Fecha: 2026-08-05
 */

import { Navigate, type RouteObject } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import { lazy, Suspense } from "react";
import Loading from "../components/common/Loading";
import AuthGuard from "../components/auth/AuthGuard";
import RutaProtegida from "../components/common/RutaProtegida";
import CentralAuthRedirectPage from "../pages/CentralAuthRedirectPage";
import { useUser } from "../context/UserContext";
import { RUTA_OBLIGACION_HACER_HIJA } from "./rutasObligacionHacer";
import { RUTA_GENERAR_DOCUMENTO_HIJA } from "./rutasGeneracionDocumento";
import { RUTA_GESTION_NOTIFICACIONES_HIJA } from "./rutasGestionNotificaciones";

/**
 * Los TRES roles que admiten las cuatro LECTURAS de `/obligacion-hacer` en el backend
 * (`@Roles('funcionario decisor', 'secretario abogado', 'director')`). Las once escrituras son sólo
 * del decisor, y de eso se encarga el motor de acciones apagando sus botones — no hace falta una
 * ruta aparte, porque las dos pantallas siguen siendo LECTURA para los otros dos roles.
 */
const ROLES_DE_LECTURA_DE_LA_RAMA = [
  "funcionario decisor",
  "secretario abogado",
  "director",
] as const;

const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const ReceptionPage = lazy(() => import("../pages/ReceptionPage"));
const AvisosPage = lazy(() => import("../pages/AvisosPage"));
const DocumentacionPage = lazy(() => import("../pages/DocumentationPage"));
// Fase 3 — bandejas de rol del sorteo (secretario / director / decisor).
const SorteoPage = lazy(() => import("../pages/SorteoPage"));
const AprobacionSorteoPage = lazy(
  () => import("../pages/AprobacionSorteoPage"),
);
const MisAsignadosPage = lazy(() => import("../pages/MisAsignadosPage"));
const SorteadosPage = lazy(() => import("../pages/SorteadosPage"));
// Fase 3.8 — Bandeja de Entrada (ingresos) por rol + modal Resultado del sorteo (reemplaza el placeholder).
const BandejaEntradaPage = lazy(() => import("../pages/BandejaEntradaPage"));
// Fase 3.9 — Bandeja de Salida (remisión a SG) compartida director+secretario (reemplaza el placeholder).
const BandejaSalidaPage = lazy(() => import("../pages/BandejaSalidaPage"));
// Fase 3.5 — Bandeja "Actas de Sorteo" (subm_path /home/actas): turno de firma secuencial del acta D2
// por rol (secretario/director), reemplaza el PlaceholderPage "en construcción".
const ActasSorteoPage = lazy(() => import("../pages/ActasSorteoPage"));
const ParametrosPage = lazy(() => import("../pages/ParametrosPage"));
const JerarquiaPage = lazy(() => import("../pages/JerarquiaPage"));
// Fase 03.18 — la rama de la obligación de hacer: el correctivo de UN expediente, con su
// identificador en la URL. La bandeja de solicitudes de sello de clausura se retiró el 2026-10-08.
const ObligacionHacerPage = lazy(() => import("../pages/ObligacionHacerPage"));
// Fase 03.19 — la generación de documentos deja de ser un modal y pasa a página propia con stepper
// (D-03, D-12). Igual que el correctivo: exige un expediente concreto, así que NO tiene submenú y no
// hay nada que sembrar en la base. Se llega desde el «⋮» de la bandeja del decisor.
const GenerarDocumentoPage = lazy(
  () => import("../pages/GenerarDocumentoPage"),
);
// Fase 03.20 — el Gestor de Notificaciones: la lectura TRANSVERSAL de todas las notificaciones del
// módulo, con el estado de cada despacho. Ésta SÍ tiene submenú (ver su entrada más abajo).
const GestionNotificacionesPage = lazy(
  () => import("../pages/GestionNotificacionesPage"),
);
// Fase 03.11 — retorno del portal de Auth central. Ruta PÚBLICA de nivel superior.
const AuthCallbackPage = lazy(() => import("../pages/AuthCallbackPage"));

/**
 * Formulario de acceso local. Viaja TAMBIÉN en el bundle de producción y lo gobierna únicamente la
 * bandera del backend (`GET /auth/mode`): se ofrece si y sólo si `authCentralEnabled === false`.
 *
 * DECISIÓN REVISADA (2026-08-07, petición del usuario). Antes se declaraba bajo `import.meta.env.DEV`,
 * así que en `vite build` el empaquetador eliminaba la rama muerta y el formulario NO EXISTÍA en el
 * despliegue. Consecuencia práctica: en el servidor, poner la bandera en `false` no daba acceso local
 * —no había formulario que enseñar— y la raíz caía siempre a la pantalla del portal, cosa nada obvia
 * desde fuera. Ahora el módulo es alcanzable sin el Auth central (demo, o portal caído).
 *
 * Lo que NO cambia: los dos caminos siguen sin poder estar vivos a la vez, porque el backend responde
 * 401 al login local cuando la bandera central está encendida (D-02) y la única fuente del modo sigue
 * siendo ese endpoint. Lo que SÍ cambia: la garantía pasa de ser **por construcción** (el código no
 * existía) a ser **por configuración** (el código existe y depende de un valor). Quien ponga la bandera
 * en `false` en producción tendrá login local operativo: eso es ahora una decisión de despliegue.
 */
const LazyLoginLayout = lazy(() => import("../layouts/LoginLayout"));

/**
 * Decide qué se ve en la raíz. No redirige automáticamente al portal (Q-13): un salto incondicional
 * desde `/` haría imposible llegar a la aplicación si el portal estuviera caído. La salida automática
 * la aplica el guard sobre el subárbol privado, que es donde sí hace falta.
 */
const RootEntry = () => {
  const { sessionState, authCentralEnabled } = useUser();

  // "Todavía no sé" no es "no hay usuario": mientras la sesión se hidrata sólo se espera (P-06).
  if (sessionState === "idle" || sessionState === "hydrating") {
    return <Loading />;
  }

  if (sessionState === "authenticated") {
    return <Navigate to="/home/dashboard" replace />;
  }

  // Modo local EXPLÍCITO: el único caso en que se ofrece el formulario. Con el modo aún sin resolver
  // (`null`) se asume central, igual que el fallo cerrado del bootstrap: nunca se ofrece el camino
  // local por no haber podido preguntar.
  if (authCentralEnabled === false) {
    return (
      <Suspense fallback={<Loading />}>
        <LazyLoginLayout />
      </Suspense>
    );
  }

  return <CentralAuthRedirectPage />;
};

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <RootEntry />,
  },
  {
    // Retorno del portal de Auth central: PÚBLICA, fuera del layout principal y fuera del guard.
    // Cuando se monta todavía no hay cookie de sesión: meterla bajo el guard la haría inalcanzable.
    path: "/auth/callback",
    element: (
      <Suspense fallback={<Loading />}>
        <AuthCallbackPage />
      </Suspense>
    ),
  },
  {
    path: "/home",
    // `element` envuelto por el guard en vez de `Component`: son claves mutuamente excluyentes, así
    // que se SUSTITUYE. Los 12 hijos quedan protegidos sin tocarse: un solo punto de control.
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        // Aterrizar en '/home' pelado dejaría el Outlet vacío; el índice manda al tablero.
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: "dashboard",
        element: (
          <Suspense fallback={<Loading />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: "expediente",
        element: (
          <Suspense fallback={<Loading />}>
            <ReceptionPage />
          </Suspense>
        ),
      },
      {
        path: "alerts",
        element: (
          <Suspense fallback={<Loading />}>
            <AvisosPage />
          </Suspense>
        ),
      },
      {
        path: "documentacion",
        element: (
          <Suspense fallback={<Loading />}>
            <DocumentacionPage />
          </Suspense>
        ),
      },
      // La ruta «notificaciones» se RETIRÓ el 2026-08-20. Era una pantalla viva del clon de
      // Resolución que consultaba /notification-administration, cuyas tablas no existen en
      // EjecucionDB: cada visita respondía 500. La notificación de Ejecución no es una bandeja
      // aparte — se crea al emitir la providencia y se ve en el propio expediente.
      {
        // Reasignaciones (secretario) — re-sortear casos liberados/excusados (misma SorteoPage por ahora).
        path: "sorteo",
        element: (
          <Suspense fallback={<Loading />}>
            <SorteoPage />
          </Suspense>
        ),
      },
      {
        // Aprobación de Sorteos (director) — aprobar lote + ver/descargar acta D2.
        path: "aprobacion-sorteo",
        element: (
          <Suspense fallback={<Loading />}>
            <AprobacionSorteoPage />
          </Suspense>
        ),
      },
      {
        // «Mis Expedientes» (decisor) — la bandeja en tabla con filtro por columna y paginado (03.19-17).
        // Fase 03.22, Plan 04 — D-01: justo aquí estaba registrada la bandeja APARTE de órdenes de
        // pago, y se retiró. El número de orden se teclea ahora en las dos columnas de ESTA bandeja
        // (Plan 02) y el historial, anuladas incluidas, se lee en la línea de tiempo del expediente
        // (Plan 03). Quien llegue a la ruta vieja cae en el comodín `*` de más abajo, que es el
        // comportamiento querido: no se deja redirección ni pantalla de despedida.
        path: "mis-asignados",
        element: (
          <Suspense fallback={<Loading />}>
            <MisAsignadosPage />
          </Suspense>
        ),
      },
      {
        // Bandeja de Entrada (subm_path /home/entrada) — Fase 3.8. Vista real por rol
        // (director/secretario) con acciones gateadas y modal Resultado del sorteo reusado.
        path: "entrada",
        element: (
          <Suspense fallback={<Loading />}>
            <BandejaEntradaPage />
          </Suspense>
        ),
      },
      {
        // Bandeja de Salida (subm_path /home/salida) — Fase 3.9. Cola COMPARTIDA director+secretario:
        // lotes finalizados/envío con la acción "Enviar a SG" gateada por rol (idempotente en el backend).
        path: "salida",
        element: (
          <Suspense fallback={<Loading />}>
            <BandejaSalidaPage />
          </Suspense>
        ),
      },
      {
        // Actas de Sorteo (subm_path /home/actas) — Fase 3.5. Bandeja REAL de turno de firma del acta
        // D2 gateada por rol (secretario/director) vía resolveLoteTurnActions; ya no es un placeholder.
        path: "actas",
        element: (
          <Suspense fallback={<Loading />}>
            <ActasSorteoPage />
          </Suspense>
        ),
      },
      {
        // Parametros del modulo (subm_path /home/parametros) — Fase 03.13. Los tres plazos, editables
        // por el administrador. El acceso lo gobierna el MENU (grant t_rol_actividad solo al rol 1) y
        // el backend, cuyo controller entero es @Roles('administrador'): esta ruta no lo re-decide.
        path: "parametros",
        element: (
          <Suspense fallback={<Loading />}>
            <ParametrosPage />
          </Suspense>
        ),
      },
      {
        // Jerarquia de usuarios (subm_path /home/jerarquia) — quick 261002-lds. El panel donde el
        // administrador declara de quien depende cada persona, que es lo que decide el alcance del
        // Tablero.
        //
        // 🔴 LA CADENA TIENE QUE RESOLVER EXACTAMENTE A `/home/jerarquia`, el `subm_path` que
        // siembra `migrations/2026-10-02-menu-jerarquia.sql`. Una letra de diferencia y el submenu
        // aparece, se pulsa y cae en el comodin `*`, devolviendo al usuario a la raiz sin ninguna
        // explicacion: ni el compilador ni la suite dirian una palabra.
        //
        // ESTA RUTA SI LLEVA `RutaProtegida`, siguiendo el criterio escrito de la Fase 03.18: el
        // guard es CONVENIENCIA —evita que quien teclea la URL vea un armazon vacio sembrado de
        // 403— y NO autorizacion, que la pone el `@Roles('administrador')` del endpoint.
        // ⚠️ NO se le retrofitea el guard a `parametros` en este quick: es otra pantalla, otro
        // commit y otra decision.
        path: "jerarquia",
        element: (
          <RutaProtegida rolesPermitidos={["administrador"]}>
            <Suspense fallback={<Loading />}>
              <JerarquiaPage />
            </Suspense>
          </RutaProtegida>
        ),
      },
      // ───────────────────────────────────────────────────────────────────────────────────────
      // Fase 03.18 — LA RAMA DE LA OBLIGACIÓN DE HACER. La única ruta que hace falta.
      //
      // 🔴 POR QUÉ ESTA LLEVA `RutaProtegida` Y LAS DE ARRIBA NO. Hoy, quien teclea la URL de
      // una pantalla que su rol no tiene LLEGA a la pantalla: la única protección es que el submenú
      // no aparezca en el sidebar, y un submenú ausente no es un control de acceso — es una omisión
      // del menú. El backend responde 403 y el dato no se filtra, pero el usuario ve un armazón
      // vacío sembrado de errores y no entiende si se rompió la aplicación o si no le corresponde.
      // El guard es CONVENIENCIA, no autorización: quien autoriza es el `@Roles` del endpoint.
      //
      // ⚠️ La página del correctivo NO tiene submenú, y es deliberado: exige un expediente concreto,
      // así que una entrada de menú apuntando aquí sería una entrada que no se puede pulsar. Se
      // llega desde la bandeja del decisor.
      //
      // ⚠️ La bandeja de solicitudes de sello de clausura (`/home/solicitudes-sello`) se RETIRÓ el
      // 2026-10-08 por pedido del área, junto con su grant
      // (ejecucion-db/migrations/2026-10-08-retiro-menu-solicitudes-sello.sql). Quien llegue a la
      // ruta vieja cae en el comodín `*`.
      // ───────────────────────────────────────────────────────────────────────────────────────
      {
        // El correctivo de UN expediente, con su identificador en la URL. Los mismos tres roles: las
        // lecturas son de los tres y la escritura ya la apaga el motor por rol.
        path: RUTA_OBLIGACION_HACER_HIJA,
        element: (
          <RutaProtegida rolesPermitidos={ROLES_DE_LECTURA_DE_LA_RAMA}>
            <Suspense fallback={<Loading />}>
              <ObligacionHacerPage />
            </Suspense>
          </RutaProtegida>
        ),
      },
      {
        // ─────────────────────────────────────────────────────────────────────────────────────
        // Fase 03.19 — LA PÁGINA DE GENERACIÓN DE DOCUMENTOS (D-03, D-12).
        //
        // 🔴 SE REGISTRA CON LA CONSTANTE, NO CON LA CADENA. La entrada «Generar documento» del
        // `⋮` NAVEGA: si la ruta que se registra aquí y la que se construye allí se separan en un
        // carácter, el enlace cae en el comodín `*` y el decisor acaba en la raíz sin que nada
        // parezca haber fallado. El literal se escribe UNA vez, en `rutasGeneracionDocumento.ts`, y
        // `menuRoutes.test.ts` exige que cualquier hija de `/home` que empiece por ese segmento sea
        // exactamente esta constante.
        //
        // ⚠️ Sin submenú y sin migración SQL, por lo mismo que la página del correctivo: exige un
        // expediente en la URL, así que una entrada de menú lateral no se podría pulsar.
        //
        // Solo el decisor: generar el documento es suyo y de nadie más (`POLITICA_ACCIONES`,
        // Plan 11). El guard sigue siendo CONVENIENCIA — quien autoriza es el `@Roles` del endpoint.
        // ─────────────────────────────────────────────────────────────────────────────────────
        path: RUTA_GENERAR_DOCUMENTO_HIJA,
        element: (
          <RutaProtegida rolesPermitidos={["funcionario decisor"]}>
            <Suspense fallback={<Loading />}>
              <GenerarDocumentoPage />
            </Suspense>
          </RutaProtegida>
        ),
      },
      {
        // ─────────────────────────────────────────────────────────────────────────────────────
        // Fase 03.20 — EL GESTOR DE NOTIFICACIONES. ÉSTA SÍ TIENE SUBMENÚ.
        //
        // 🔴 SU CAMINO ES EXACTAMENTE EL QUE SIEMBRA `2026-09-25-menu-gestion-notificaciones.sql`
        // (submenú 10, `/home/gestion-notificaciones`), y se registra CON LA CONSTANTE, nunca con la
        // cadena a mano: el menú lateral lo arma `usu_get_user` en la base y navega a ese
        // `subm_path`, así que una letra de diferencia deja la pantalla registrada y su enlace del
        // menú cayendo en el comodín `*` — se ve, se pulsa y devuelve al usuario a la raíz.
        //
        // 🔴 SIN ESA MIGRACIÓN LA PANTALLA EXISTE Y NO LA VE NADIE: quien decide quién la ve es el
        // GRANT de la base (los grants 46/47 a los roles 2 y 3), no este archivo. Un despliegue de
        // frontend sin su migración hermana deja el Gestor escrito y ausente del sidebar.
        //
        // Los DOS roles del grant. El guard sigue siendo CONVENIENCIA —quien autoriza es el `@Roles`
        // del endpoint del Gestor (Plan 04)—: sirve para que quien llega por un enlace profundo sin
        // el submenú no vea un armazón vacío sembrado de 403.
        // ─────────────────────────────────────────────────────────────────────────────────────
        path: RUTA_GESTION_NOTIFICACIONES_HIJA,
        element: (
          <RutaProtegida rolesPermitidos={["secretario abogado", "director"]}>
            <Suspense fallback={<Loading />}>
              <GestionNotificacionesPage />
            </Suspense>
          </RutaProtegida>
        ),
      },
      {
        // Sorteados (secretario/director) — SOLO CONSULTA: todo lo sorteado con su estado real
        // (pendiente / aprobado + acta / rechazado + motivo). Sin acciones mutantes.
        path: "sorteados",
        element: (
          <Suspense fallback={<Loading />}>
            <SorteadosPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    // Último recurso: un enlace profundo inválido pasa por la raíz —y por tanto por la decisión de
    // modo— en vez de renderizar una pantalla en blanco.
    path: "*",
    element: <Navigate to="/" replace />,
  },
];
