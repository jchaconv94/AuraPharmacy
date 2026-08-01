-- ============================================================================
--  SEGURIDAD - EJECUTAR ESTE ARCHIVO COMPLETO, UNA SOLA VEZ
-- ============================================================================
--
--  QUÉ HACE
--
--  Cierra el agujero por el que cualquiera podía crear un usuario ADMIN y entrar
--  al sistema, y a la vez deja funcionando la administración de usuarios.
--
--  CÓMO EJECUTARLO
--
--  1. Entra a supabase.com y abre tu proyecto.
--  2. Menú izquierdo -> SQL Editor -> New query.
--  3. Copia TODO este archivo, pégalo y presiona Run.
--  4. Al final debe aparecer una tabla que dice "TODO CORRECTO".
--
--  Después de ejecutarlo hay que desplegar la aplicación actualizada. Hasta que
--  la despliegues, la administración de usuarios dejará de funcionar; el resto
--  del sistema sigue normal.
--
--  SI ALGO SALE MAL
--
--  Al final del archivo están las sentencias para dejar todo como estaba.
-- ============================================================================


-- ============================================================================
--  PARTE 1 - Preparación
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Tabla de sesiones. Al iniciar sesión se crea un token temporal, y ese token es
-- lo que autoriza las operaciones administrativas. Nadie puede leerla ni
-- escribirla directamente: solo las funciones de más abajo.
CREATE TABLE IF NOT EXISTS public.app_sessions (
  token       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '12 hours')
);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_sessions FROM anon, authenticated;


-- ============================================================================
--  PARTE 2 - Funciones
-- ============================================================================

-- Devuelve el usuario dueño de un token vigente, o NULL.
CREATE OR REPLACE FUNCTION public.app_session_user(p_token uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT s.username
  FROM public.app_sessions s
  JOIN public.users u ON u.username = s.username
  WHERE s.token = p_token
    AND s.expires_at > now()
    AND u.is_active;
$$;

REVOKE ALL ON FUNCTION public.app_session_user(uuid) FROM PUBLIC, anon, authenticated;


-- Igual que la anterior, pero además exige que sea ADMIN. Lanza error si no.
CREATE OR REPLACE FUNCTION public.app_require_admin(p_token uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_username text;
  v_role     text;
BEGIN
  SELECT u.username, u.role INTO v_username, v_role
  FROM public.app_sessions s
  JOIN public.users u ON u.username = s.username
  WHERE s.token = p_token AND s.expires_at > now() AND u.is_active;

  IF v_username IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida o expirada. Vuelva a iniciar sesión.';
  END IF;

  IF upper(v_role) <> 'ADMIN' THEN
    RAISE EXCEPTION 'Esta operación requiere permisos de administrador.';
  END IF;

  RETURN v_username;
END;
$$;

REVOKE ALL ON FUNCTION public.app_require_admin(uuid) FROM PUBLIC, anon, authenticated;


-- Verifica la contraseña sin que el hash salga de la base.
CREATE OR REPLACE FUNCTION public.app_verify_password(p_username text, p_password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.username = p_username
      AND u.password_hash IS NOT NULL
      AND u.password_hash = crypt(p_password, u.password_hash)
  );
$$;

REVOKE ALL ON FUNCTION public.app_verify_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_verify_password(text, text) TO anon, authenticated;


-- Inicia sesión: valida la contraseña y devuelve un token. NULL si es incorrecta.
CREATE OR REPLACE FUNCTION public.app_login(p_username text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_token uuid;
BEGIN
  DELETE FROM public.app_sessions WHERE expires_at < now();

  IF NOT public.app_verify_password(p_username, p_password) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.app_sessions (username)
  VALUES (p_username)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.app_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_login(text, text) TO anon, authenticated;


-- Cierra la sesión.
CREATE OR REPLACE FUNCTION public.app_logout(p_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  DELETE FROM public.app_sessions WHERE token = p_token;
$$;

REVOKE ALL ON FUNCTION public.app_logout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_logout(uuid) TO anon, authenticated;


-- Crear o editar un usuario. Solo ADMIN.
CREATE OR REPLACE FUNCTION public.app_admin_save_user(
  p_token        uuid,
  p_username     text,
  p_role         text,
  p_personnel_id text,
  p_is_active    boolean,
  p_password     text,
  p_is_new       boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_hash text;
BEGIN
  PERFORM public.app_require_admin(p_token);

  IF p_password IS NOT NULL AND length(p_password) > 0 THEN
    v_hash := crypt(p_password, gen_salt('bf', 10));
  END IF;

  IF p_is_new THEN
    INSERT INTO public.users (username, role, personnel_id, is_active, password_hash)
    VALUES (
      p_username,
      p_role,
      p_personnel_id,
      COALESCE(p_is_active, true),
      COALESCE(v_hash, crypt('Temporal2026*', gen_salt('bf', 10)))
    );
  ELSE
    UPDATE public.users
    SET role         = p_role,
        personnel_id = p_personnel_id,
        is_active    = COALESCE(p_is_active, true),
        password_hash = COALESCE(v_hash, password_hash)
    WHERE username = p_username;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.app_admin_save_user(uuid, text, text, text, boolean, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_admin_save_user(uuid, text, text, text, boolean, text, boolean) TO anon, authenticated;


-- Activar o desactivar un usuario. Solo ADMIN.
CREATE OR REPLACE FUNCTION public.app_admin_toggle_user(p_token uuid, p_username text, p_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.app_require_admin(p_token);
  UPDATE public.users SET is_active = p_status WHERE username = p_username;
END;
$$;

REVOKE ALL ON FUNCTION public.app_admin_toggle_user(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_admin_toggle_user(uuid, text, boolean) TO anon, authenticated;


-- Eliminar un usuario. Solo ADMIN. No permite que un admin se borre a sí mismo.
CREATE OR REPLACE FUNCTION public.app_admin_delete_user(p_token uuid, p_username text, p_personnel_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_actor text;
BEGIN
  v_actor := public.app_require_admin(p_token);

  IF v_actor = p_username THEN
    RAISE EXCEPTION 'No puede eliminar su propia cuenta.';
  END IF;

  DELETE FROM public.users WHERE username = p_username;

  IF p_personnel_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.personnel WHERE id = p_personnel_id;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- El personal puede estar referenciado por otros registros.
    END;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.app_admin_delete_user(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_admin_delete_user(uuid, text, text) TO anon, authenticated;


-- Cambiar el usuario o la contraseña de la propia cuenta.
CREATE OR REPLACE FUNCTION public.app_update_own_account(
  p_token        uuid,
  p_personnel_id text,
  p_new_username text,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_actor text;
  v_owner text;
BEGIN
  v_actor := public.app_session_user(p_token);
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida o expirada. Vuelva a iniciar sesión.';
  END IF;

  SELECT username INTO v_owner FROM public.users WHERE personnel_id = p_personnel_id;

  -- Solo sobre la cuenta propia, salvo que quien llama sea ADMIN.
  IF v_owner IS DISTINCT FROM v_actor THEN
    PERFORM public.app_require_admin(p_token);
  END IF;

  IF p_new_username IS NOT NULL AND length(p_new_username) > 0 THEN
    UPDATE public.users SET username = p_new_username WHERE personnel_id = p_personnel_id;
  END IF;

  IF p_new_password IS NOT NULL AND length(p_new_password) > 0 THEN
    UPDATE public.users
    SET password_hash = crypt(p_new_password, gen_salt('bf', 10))
    WHERE personnel_id = p_personnel_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.app_update_own_account(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_update_own_account(uuid, text, text, text) TO anon, authenticated;


-- Guardar la configuración de un rol. Solo ADMIN.
CREATE OR REPLACE FUNCTION public.app_admin_save_role_config(
  p_token              uuid,
  p_role               text,
  p_old_role           text,
  p_label              text,
  p_allowed_modules    jsonb,
  p_max_urls_allowed   integer,
  p_jurisdiction_level text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.app_require_admin(p_token);

  IF p_old_role IS NOT NULL AND p_old_role <> p_role THEN
    UPDATE public.roles_config SET role = p_role WHERE role = p_old_role;
  END IF;

  INSERT INTO public.roles_config (role, label, allowed_modules, max_urls_allowed, jurisdiction_level)
  VALUES (p_role, p_label, p_allowed_modules, p_max_urls_allowed, p_jurisdiction_level)
  ON CONFLICT (role) DO UPDATE
  SET label              = EXCLUDED.label,
      allowed_modules    = EXCLUDED.allowed_modules,
      max_urls_allowed   = EXCLUDED.max_urls_allowed,
      jurisdiction_level = EXCLUDED.jurisdiction_level;
END;
$$;

REVOKE ALL ON FUNCTION public.app_admin_save_role_config(uuid, text, text, text, jsonb, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_admin_save_role_config(uuid, text, text, text, jsonb, integer, text) TO anon, authenticated;


-- ============================================================================
--  PARTE 3 - Cerrar los permisos abiertos
-- ============================================================================

-- Ya nadie necesita escribir estas tablas directamente: todo pasa por las
-- funciones de arriba, que verifican quién llama.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.users        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.roles_config FROM anon, authenticated;

-- El hash de contraseña deja de ser legible desde fuera.
--
-- Ojo: `REVOKE SELECT (password_hash)` no basta. Si existe un permiso de SELECT sobre la
-- tabla completa, PostgreSQL no permite restarle una columna y el hash seguiría visible.
-- Por eso se quita el permiso general y se concede solo sobre las columnas que usa la
-- aplicación (la constante `USER_SELECT` de `services/api.ts`).
REVOKE SELECT ON public.users FROM anon, authenticated;

GRANT SELECT (username, role, personnel_id, is_active, created_at)
  ON public.users TO anon, authenticated;


-- ============================================================================
--  PARTE 4 - Comprobación
-- ============================================================================

WITH revisiones AS (
  SELECT 'Escritura sobre users cerrada' AS revision,
         NOT EXISTS (
           SELECT 1 FROM information_schema.table_privileges
           WHERE table_schema = 'public' AND table_name = 'users'
             AND grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
         ) AS correcto
  UNION ALL
  SELECT 'Hash de contraseña oculto',
         NOT EXISTS (
           SELECT 1 FROM information_schema.column_privileges
           WHERE table_schema = 'public' AND table_name = 'users'
             AND column_name = 'password_hash' AND grantee = 'anon'
         )
  UNION ALL
  SELECT 'Escritura sobre roles_config cerrada',
         NOT EXISTS (
           SELECT 1 FROM information_schema.table_privileges
           WHERE table_schema = 'public' AND table_name = 'roles_config'
             AND grantee = 'anon' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
         )
  UNION ALL
  SELECT 'Las funciones quedaron creadas',
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname IN
            ('app_login','app_logout','app_verify_password','app_session_user','app_require_admin',
             'app_admin_save_user','app_admin_toggle_user','app_admin_delete_user',
             'app_update_own_account','app_admin_save_role_config')) = 10
  UNION ALL
  SELECT 'pgcrypto entiende los hashes actuales',
         (SELECT crypt('x', u.password_hash) <> u.password_hash
          FROM public.users u WHERE u.password_hash LIKE '$2%' LIMIT 1)
)
SELECT
  CASE WHEN bool_and(correcto) THEN 'TODO CORRECTO' ELSE 'HAY ALGO MAL - revisar el detalle' END AS resultado,
  string_agg(CASE WHEN NOT correcto THEN revision END, ' | ') AS fallos
FROM revisiones;


-- ============================================================================
--  REVERSIÓN, solo si hiciera falta volver atrás
-- ============================================================================
--
--  GRANT INSERT, UPDATE, DELETE ON public.users        TO anon;
--  GRANT INSERT, UPDATE, DELETE ON public.roles_config TO anon;
--  GRANT SELECT ON public.users                        TO anon, authenticated;
