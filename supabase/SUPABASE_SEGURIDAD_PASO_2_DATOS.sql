-- ============================================================================
--  SEGURIDAD, PASO 2 - Proteger los datos de inmunizaciones
-- ============================================================================
--
--  QUÉ HACE
--
--  Hoy cualquiera con la clave pública puede leer, modificar y borrar el stock, los
--  movimientos y los cierres mensuales. Este script hace que la base solo entregue
--  esos datos a quien tenga una sesión iniciada en la aplicación.
--
--  CÓMO FUNCIONA
--
--  Al iniciar sesión, el servidor entrega un token. La aplicación lo envía en cada
--  petición dentro de la cabecera `x-session-token`. Las políticas de abajo lo
--  comprueban: si no hay token válido, la tabla no devuelve nada.
--
--  ORDEN - MUY IMPORTANTE
--
--    1. PRIMERO desplegar la aplicación con el cambio de `services/supabaseClient.ts`.
--    2. DESPUÉS ejecutar este script.
--
--  Si se ejecuta antes de desplegar, la aplicación deja de ver los datos de
--  inmunizaciones hasta que el despliegue se complete. La reversión está al final y
--  es inmediata.
--
--  CÓMO EJECUTARLO
--
--    supabase.com -> tu proyecto -> SQL Editor -> New query -> pegar todo -> Run
--    Al final debe aparecer "TODO CORRECTO".
-- ============================================================================


-- ----------------------------------------------------------------------------
--  PARTE 1 - Quién tiene sesión válida
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_request_has_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_sessions s
    JOIN public.users u ON u.username = s.username
    WHERE s.expires_at > now()
      AND u.is_active
      AND s.token::text = COALESCE(
            NULLIF(current_setting('request.headers', true), '')::json ->> 'x-session-token',
            ''
          )
  );
$fn$;

REVOKE ALL ON FUNCTION public.app_request_has_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_request_has_session() TO anon, authenticated;


-- ----------------------------------------------------------------------------
--  PARTE 2 - Aplicar la protección a las tablas de inmunizaciones
-- ----------------------------------------------------------------------------
--
--  Se eliminan primero las políticas provisionales que traían las migraciones del
--  módulo, para que no queden reglas permisivas conviviendo con las nuevas.

DO $bloque$
DECLARE
  v_tabla   text;
  v_politica record;
  v_tablas  text[] := ARRAY[
    'immunization_products',
    'immunization_initial_inventories',
    'immunization_initial_inventory_items',
    'immunization_stock_layers',
    'immunization_stock_movements',
    'immunization_adjustments',
    'immunization_adjustment_items',
    'immunization_income_origins',
    'immunization_income_batches',
    'immunization_income_items',
    'immunization_distribution_batches',
    'immunization_distribution_items',
    'immunization_return_batches',
    'immunization_return_items',
    'immunization_monthly_closures'
  ];
BEGIN
  FOREACH v_tabla IN ARRAY v_tablas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = v_tabla
    ) THEN
      RAISE NOTICE 'La tabla % no existe, se omite.', v_tabla;
      CONTINUE;
    END IF;

    FOR v_politica IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tabla
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_politica.policyname, v_tabla);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabla);

    EXECUTE format(
      'CREATE POLICY app_sesion_valida ON public.%I FOR ALL TO anon, authenticated '
      'USING (public.app_request_has_session()) '
      'WITH CHECK (public.app_request_has_session())',
      v_tabla
    );

    RAISE NOTICE 'Protegida: %', v_tabla;
  END LOOP;
END
$bloque$;


-- ----------------------------------------------------------------------------
--  PARTE 3 - Comprobación
-- ----------------------------------------------------------------------------

WITH esperadas AS (
  SELECT unnest(ARRAY[
    'immunization_products','immunization_initial_inventories',
    'immunization_initial_inventory_items','immunization_stock_layers',
    'immunization_stock_movements','immunization_adjustments',
    'immunization_adjustment_items','immunization_income_origins',
    'immunization_income_batches','immunization_income_items',
    'immunization_distribution_batches','immunization_distribution_items',
    'immunization_return_batches','immunization_return_items',
    'immunization_monthly_closures'
  ]) AS tabla
),
estado AS (
  SELECT
    e.tabla,
    COALESCE(c.relrowsecurity, false) AS rls_activo,
    EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = e.tabla
        AND p.policyname = 'app_sesion_valida'
    ) AS politica_puesta
  FROM esperadas e
  LEFT JOIN pg_class c ON c.relname = e.tabla
    AND c.relnamespace = 'public'::regnamespace
)
SELECT
  CASE WHEN bool_and(rls_activo AND politica_puesta)
       THEN 'TODO CORRECTO'
       ELSE 'HAY ALGO MAL - revisar el detalle' END AS resultado,
  count(*) FILTER (WHERE rls_activo AND politica_puesta) AS tablas_protegidas,
  count(*) AS tablas_totales,
  string_agg(tabla, ', ') FILTER (WHERE NOT (rls_activo AND politica_puesta)) AS pendientes
FROM estado;


-- ----------------------------------------------------------------------------
--  REVERSIÓN, si la aplicación dejara de ver los datos
-- ----------------------------------------------------------------------------
--
--  Deja las tablas como estaban antes de este script:
--
--  DO $rev$
--  DECLARE v_tabla text;
--  BEGIN
--    FOREACH v_tabla IN ARRAY ARRAY[
--      'immunization_products','immunization_initial_inventories',
--      'immunization_initial_inventory_items','immunization_stock_layers',
--      'immunization_stock_movements','immunization_adjustments',
--      'immunization_adjustment_items','immunization_income_origins',
--      'immunization_income_batches','immunization_income_items',
--      'immunization_distribution_batches','immunization_distribution_items',
--      'immunization_return_batches','immunization_return_items',
--      'immunization_monthly_closures'
--    ] LOOP
--      EXECUTE format('DROP POLICY IF EXISTS app_sesion_valida ON public.%I', v_tabla);
--      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', v_tabla);
--    END LOOP;
--  END
--  $rev$;
