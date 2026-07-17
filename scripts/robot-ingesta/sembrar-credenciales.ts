/**
 * SEMBRAR CREDENCIALES · un solo uso.
 *
 * Copia las claves de Rushour y Sinqro que ya viven en los secretos de GitHub a
 * la tabla robot_credenciales de Supabase, para que TODO (robots, panel en vivo,
 * funciones de Supabase) beba de un único sitio y no haya que pedírselas a nadie.
 * No imprime ninguna contraseña.
 */
import { sb, log } from './_lib/bandeja.js';

async function main() {
  const filas = [
    {
      plataforma: 'rushour',
      cuenta: 'streatlab',
      usuario: process.env.RUSHOUR_USER || '',
      password: process.env.RUSHOUR_PASS || '',
      url_base: 'https://manager.rushour.io/login',
      otp_remitente: null,
      notas: 'Rushour Business Manager. Cognito eu-west-2_YYLWn5dFb · restaurante 51a3d71b-db53-48a2-b4ea-8b6029cdea17',
    },
    {
      plataforma: 'sinqro',
      cuenta: 'streatlab',
      usuario: process.env.SINQRO_USER || '',
      password: process.env.SINQRO_PASS || '',
      url_base: 'https://panel.sinqro.com',
      otp_remitente: null,
      notas: 'Sinqro · selling point 3976805',
    },
  ].filter((f) => f.usuario && f.password);

  if (filas.length === 0) { await log('semilla', 'error', 'no hay secretos en el entorno'); process.exitCode = 1; return; }

  const { error } = await sb.from('robot_credenciales').upsert(filas, { onConflict: 'plataforma,cuenta' });
  if (error) { await log('semilla', 'error', error.message); process.exitCode = 1; return; }
  await log('semilla', 'ok', `credenciales guardadas: ${filas.map((f) => f.plataforma).join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
