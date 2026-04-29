# SPEC — Binagre Google Auth + Whitelist (en paralelo a PIN)

## Contexto
- Repo: Streatlab/binagre
- Path local: C:\streatlab-erp
- Supabase project: eryauogxcpbgdryeimdq
- URL: binagre.vercel.app
- Login actual: PIN propio contra tabla `usuarios`. Mantener funcionando 100%.
- Aislamiento absoluto vs erp-david. Skills aplicables: binagre-erp, binagre-kit-visual.

## Objetivo
Añadir login Google Auth como segunda opción en pantalla de login, con whitelist de 3 emails, sin tocar el flujo PIN actual.

## Whitelist (idéntica en ambos ERPs)
- rubenrodriguezvinagre@gmail.com
- emiliodorcamartinez@gmail.com
- davidsanzn@gmail.com

## Criterios DADO / CUANDO / ENTONCES

**DADO** un usuario abre binagre.vercel.app sin sesión activa
**CUANDO** llega a la pantalla de login
**ENTONCES** ve el formulario PIN actual intacto, y debajo, separados por un "ó", un botón "Entrar con Google" en estilo binagre-kit-visual.

**DADO** un usuario pulsa "Entrar con Google" con uno de los 3 emails de la whitelist
**CUANDO** completa el flujo Google OAuth
**ENTONCES** entra al dashboard con sesión válida y rol cargado.

**DADO** un usuario pulsa "Entrar con Google" con un email NO en whitelist
**CUANDO** completa el flujo Google OAuth
**ENTONCES** se ejecuta `supabase.auth.signOut()`, redirect `/login?error=no_autorizado`, toast "Acceso no autorizado".

**DADO** el login PIN funcionaba antes
**CUANDO** se despliega esta feature
**ENTONCES** sigue funcionando exactamente igual con los mismos PINs.

**DADO** un usuario tiene sesión Supabase Auth Y sesión PIN
**CUANDO** la app verifica autenticación
**ENTONCES** prioriza la sesión Supabase Auth.

**DADO** un usuario pulsa logout
**CUANDO** se ejecuta el handler
**ENTONCES** cierra ambas sesiones (Supabase Auth + PIN).

## Tareas técnicas

1. **Google Provider en Supabase.** Habilitar Google OAuth en proyecto `eryauogxcpbgdryeimdq`. Si faltan credenciales, generar `SETUP_GOOGLE_OAUTH.md` en raíz del repo con pasos para Google Cloud Console y URL de redirect específica de este proyecto Supabase.

2. **Migration whitelist.** Nueva migration en `supabase/migrations/` que cree `public.usuarios_autorizados` con columnas: `id` (uuid PK), `email` (text unique), `nombre`, `rol` (default 'admin'), `activo` (default true), `created_at`. RLS activada. Política `service_role_only` (FOR ALL TO service_role). Política `auth_read_self` (FOR SELECT TO authenticated USING auth.email() = email). Insertar los 3 emails con rol admin.

3. **UI login.** Añadir botón "Entrar con Google" debajo del PIN, separador "ó". Estilo binagre-kit-visual (sidebar #1e2233, accent #B01D23, base #0a0a0a). NO tocar el formulario PIN.

4. **Ruta /auth/callback.** Recibir sesión Supabase Auth, leer `auth.email()`, consultar `usuarios_autorizados`. Si NO existe o `activo=false` → signOut + redirect `/login?error=no_autorizado` + toast. Si existe → guardar sesión en mismo store/context que PIN, redirect dashboard.

5. **Coexistencia.** Estado de "usuario logueado" puede venir de PIN o Google. Priorizar Google si ambos. Logout cierra ambos.

## Restricciones duras
- NO tocar tablas existentes ni RLS existente (ya aplicada hoy 29/04: 38 tablas con política `allow_all_anon_auth`, `cuentas_bancarias` y `google_oauth_tokens` cerradas a service_role, vistas SECURITY DEFINER pasadas a INVOKER, funciones con search_path fijo).
- NO tocar lógica de negocio.
- NO mezclar tokens visuales con david-kit-visual.
- NO tocar Supabase de David.

## Pipeline obligatorio
1. Plan Mode (Shift+Tab hasta plan mode on) antes de tocar código.
2. Worktree: `claude -w binagre-google-auth`.
3. Subagentes: pm-spec → architect-review → implementer (worktree) → qa-reviewer.
4. Cada etapa produce su archivo en `.claude/plans/`.
5. QA: PIN sigue funcionando, Google rechaza emails fuera de whitelist.

## Cierre obligatorio
```
git add . && git commit -m "feat: Google Auth + whitelist 3 usuarios en paralelo a PIN" && git push origin master && npx vercel --prod && git pull origin master
```

## Notas
- Tras validar que Google funciona sin sorpresas con los 3 usuarios, eliminaremos el login PIN en una segunda spec.
- RLS y vistas/funciones de seguridad ya aplicadas hoy directamente en Supabase. Esta spec NO toca eso.
