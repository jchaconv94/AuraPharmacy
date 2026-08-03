import { AppModule } from "../types";

/**
 * Rutas de la aplicación.
 *
 * Cada módulo tiene su propia dirección, de modo que se pueda compartir un enlace,
 * recargar sin perder la pantalla y usar los botones de atrás y adelante del navegador.
 *
 * No se usa una librería de rutas: la aplicación ya navega con un único estado
 * `currentView`, así que basta con traducir ese estado a una dirección y viceversa.
 */

/** Prefijo bajo el que se publica la aplicación (`base` en `vite.config.ts`). */
export const APP_BASE = "/ToolkitSISMED";

const RUTAS: Record<AppModule, string> = {
  DASHBOARD: "/analisis",
  ANALYSIS: "/analisis-inteligente",
  SIG_SEARCH: "/consulta-stock",
  REDISTRIBUTION: "/redistribucion",
  IPRESS_STOCK: "/stock-sismed",
  STOCK_MONITORING: "/monitoreo-stock",
  PROFILE: "/perfil",

  IMMUNIZATION_CATALOG: "/inmunizaciones/catalogo",
  IMMUNIZATION_INITIAL_INVENTORY: "/inmunizaciones/inventario-inicial",
  IMMUNIZATION_STOCK: "/inmunizaciones/stock",
  IMMUNIZATION_STOCK_QUERY: "/inmunizaciones/consulta-stock",
  IMMUNIZATION_INCOMES: "/inmunizaciones/ingresos",
  IMMUNIZATION_INCOME_ORIGINS: "/inmunizaciones/origenes-ingreso",
  IMMUNIZATION_DISTRIBUTIONS: "/inmunizaciones/distribuciones",
  IMMUNIZATION_CONSUMPTION: "/inmunizaciones/consumo",
  IMMUNIZATION_RETURNS: "/inmunizaciones/devoluciones",
  IMMUNIZATION_ADJUSTMENTS: "/inmunizaciones/reajustes",
  IMMUNIZATION_CLOSURES: "/inmunizaciones/cierre-mensual",
  IMMUNIZATION_REPORTS: "/inmunizaciones/reportes",

  ADMIN_USERS: "/administracion/usuarios",
  ADMIN_ROLES: "/administracion/roles",
  ADMIN_FACILITIES: "/administracion/establecimientos",
  ADMIN_CATALOGS: "/administracion/regimenes-profesiones",
  ADMIN_PARAMS: "/administracion/parametros",
  ADMIN_MIGRATION: "/administracion/migracion",
  ADMIN_STOCK_ASSIGN: "/administracion/asignar-stock",
  ADMIN_SYNC_DEVICES: "/administracion/dispositivos"
};

const MODULOS_POR_RUTA = new Map<string, AppModule>(
  (Object.entries(RUTAS) as Array<[AppModule, string]>).map(([modulo, ruta]) => [ruta, modulo])
);

/** Quita barras sobrantes para que `/a/b/` y `/a/b` sean la misma ruta. */
const normalizar = (ruta: string) => {
  const limpia = ruta.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return limpia.startsWith("/") ? limpia : `/${limpia}`;
};

/** Dirección completa de un módulo, lista para el navegador. */
export const pathForModule = (module: AppModule): string => `${APP_BASE}${RUTAS[module] || RUTAS.DASHBOARD}`;

/**
 * Módulo que corresponde a una dirección, o `null` si no reconoce ninguna.
 *
 * Acepta la dirección con o sin el prefijo de publicación, porque en desarrollo y en
 * producción la aplicación cuelga de rutas distintas.
 */
export const moduleForPath = (pathname: string): AppModule | null => {
  let ruta = normalizar(pathname);
  if (ruta === APP_BASE || ruta === "") return null;
  if (ruta.startsWith(`${APP_BASE}/`)) ruta = ruta.slice(APP_BASE.length);
  return MODULOS_POR_RUTA.get(ruta) || null;
};
