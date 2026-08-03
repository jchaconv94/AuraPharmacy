-- ============================================================================
--  SEGURIDAD, PASO 4 - Cerrar las tablas que quedan
-- ============================================================================
--
--  QUÉ RESUELVE
--
--  Las tablas de inmunizaciones ya exigen sesión. Las demás no: con la clave
--  pública todavía se pueden leer los datos del personal, los establecimientos,
--  la organización territorial y el stock de farmacia, sin iniciar sesión.
--
--  Este script les aplica la misma regla: sin sesión válida, no devuelven nada.
--
--  QUÉ SE DEJA ABIERTO A PROPÓSITO
--
--  `system_config` es la única tabla que la aplicación consulta ANTES de iniciar
--  sesión (verificado el 2026-08-01: son las dos únicas peticiones que salen en la
--  pantalla de login). Si se cierra, la aplicación no arranca.
--
--  QUÉ NO SE ROMPE
--
--  La función `sync-stock` usa la clave de servicio, que no pasa por estas reglas,
--  así que la sincronización con la aplicación de escritorio sigue igual.
--
--  CÓMO EJECUTARLO - POR PARTES
--
--    1. Ejecuta el BLOQUE 1 y entra a la aplicación. Revisa Stock SISMED y Análisis.
--    2. Si todo se ve, ejecuta el BLOQUE 2.
--    3. CIERRA SESIÓN Y VUELVE A ENTRAR. El bloque 2 toca las tablas del login, así
--       que ese es el paso que hay que probar de verdad.
--
--  El bloque 2 va aparte justamente para que, si algo falla, sepas cuál fue.
--  Reversión al final del archivo.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  BLOQUE 1 - Tablas que no intervienen en el login
-- ----------------------------------------------------------------------------

DO $b1$
DECLARE
  v_tabla text;
  v_pol   record;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'diresas',
    'ogess',
    'microredes',
    'facility_stock_assignments',
    'labor_regimes',
    'professions',
    'stock_actual',
    'stock_sync_history',
    'sync_installations',
    'sync_runs',
    'unget_configs',
    'user_subscriptions'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = v_tabla) THEN
      RAISE NOTICE 'No existe, se omite: %', v_tabla;
      CONTINUE;
    END IF;

    FOR v_pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tabla LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tabla);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabla);
    EXECUTE format(
      'CREATE POLICY app_sesion_valida ON public.%I FOR ALL TO anon, authenticated '
      'USING (public.app_request_has_session()) '
      'WITH CHECK (public.app_request_has_session())',
      v_tabla);

    RAISE NOTICE 'Protegida: %', v_tabla;
  END LOOP;
END
$b1$;

-- >>> ENTRA A LA APLICACIÓN Y COMPRUEBA QUE TODO SE VE. LUEGO SIGUE. <<<


-- ----------------------------------------------------------------------------
--  BLOQUE 2 - Tablas que usa el inicio de sesión
-- ----------------------------------------------------------------------------
--
--  `users`, `personnel`, `facilities`, `roles_config` y `ungets` se consultan al
--  armar el perfil, justo después de validar la contraseña. Para entonces la
--  aplicación ya tiene el token, así que la regla se cumple.
--
--  `app_login` y las demás funciones son SECURITY DEFINER: se ejecutan como dueñas
--  de las tablas y no las afecta esta regla. Por eso se puede iniciar sesión aunque
--  `users` quede cerrada.

DO $b2$
DECLARE
  v_tabla text;
  v_pol   record;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'ungets',
    'facilities',
    'personnel',
    'roles_config',
    'users'
  ] LOOP
    FOR v_pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tabla LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tabla);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabla);
    EXECUTE format(
      'CREATE POLICY app_sesion_valida ON public.%I FOR ALL TO anon, authenticated '
      'USING (public.app_request_has_session()) '
      'WITH CHECK (public.app_request_has_session())',
      v_tabla);

    RAISE NOTICE 'Protegida: %', v_tabla;
  END LOOP;
END
$b2$;

-- >>> CIERRA SESIÓN Y VUELVE A ENTRAR PARA COMPROBARLO. <<<


-- ----------------------------------------------------------------------------
--  BLOQUE 3 - Comprobación
-- ----------------------------------------------------------------------------

SELECT
  c.relname AS tabla,
  c.relrowsecurity AS exige_sesion,
  EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  ) AS tiene_politica
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- `system_config` debe ser la única en quedar sin RLS. Si aparece alguna otra,
-- revisa si la aplicación la necesita antes del login antes de cerrarla.


-- ----------------------------------------------------------------------------
--  REVERSIÓN
-- ----------------------------------------------------------------------------
--
--  DO $rev$
--  DECLARE v_tabla text;
--  BEGIN
--    FOREACH v_tabla IN ARRAY ARRAY[
--      'diresas','ogess','microredes','facility_stock_assignments','labor_regimes',
--      'professions','stock_actual','stock_sync_history','sync_installations',
--      'sync_runs','unget_configs','user_subscriptions',
--      'ungets','facilities','personnel','roles_config','users'
--    ] LOOP
--      EXECUTE format('DROP POLICY IF EXISTS app_sesion_valida ON public.%I', v_tabla);
--      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', v_tabla);
--    END LOOP;
--  END
--  $rev$;
