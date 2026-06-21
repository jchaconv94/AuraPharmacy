import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

async function hashToken(token: string) {
  const messageBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Configurar CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-installation-token, x-toolkit-version',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Leer el token desde Authorization Bearer o X-Installation-Token
    let token = req.headers.get('x-installation-token');
    const authHeader = req.headers.get('authorization');
    if (!token && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token de instalación no proporcionado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const { mode, record_count, records, toolkit_version, fecha_equipo, sismed_path } = payload;

    // Validar que los records sean un array
    if (!Array.isArray(records)) {
      return new Response(JSON.stringify({ error: 'Error de validación: records debe ser un arreglo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Inicializar cliente Supabase con service_role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
       return new Response(JSON.stringify({ error: 'Configuración del servidor incompleta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Hashear el token y buscarlo en sync_installations.token_hash
    const hashedToken = await hashToken(token);
    
    const { data: installation, error: instError } = await supabase
      .from('sync_installations')
      .select('*')
      .eq('token_hash', hashedToken)
      .single();

    // 3. Rechazar si la instalación no existe o no está activa
    if (instError || !installation) {
      return new Response(JSON.stringify({ error: 'Instalación no válida o no encontrada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!installation.is_active) {
      return new Response(JSON.stringify({ error: 'Instalación inactiva' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const facilityCode = installation.facility_code;
    const allowedAlmcods = installation.allowed_almcods || [];

    // Validar ruta SISMED (auditoría sin bloquear)
    let newLastSismedPath = installation.last_sismed_path || installation.sismed_path || "";
    let newPathChangedAt = installation.path_changed_at;
    const reportedPath = sismed_path || payload.last_sismed_path || payload.sismed_path_reported || "";

    if (reportedPath && reportedPath !== newLastSismedPath) {
      newLastSismedPath = reportedPath;
      newPathChangedAt = new Date().toISOString();
    }

    // Listas para control de ALMCODs
    const validIncomingAlmcods = new Set<string>();
    const invalidIncomingAlmcods = new Set<string>();
    
    const cleanedRecords: any[] = [];
    
    for (const record of records) {
      const recAlmcod = record.almcod;
      if (!recAlmcod) continue;
      
      // Validación de pertenencia al facility_code o allowed_almcods
      let isValidAlmcod = false;
      if (allowedAlmcods.length > 0) {
        isValidAlmcod = allowedAlmcods.includes(recAlmcod);
      } else {
        // Regla: pertenece a facility_code si coincide o empieza con el código base (5 caracteres)
        isValidAlmcod = (recAlmcod === facilityCode || recAlmcod.startsWith(facilityCode));
      }

      if (isValidAlmcod) {
        validIncomingAlmcods.add(recAlmcod);
        cleanedRecords.push({
          facility_code: facilityCode, // Siempre usar el establecido del dispositivo
          almcod: recAlmcod,
          desc_alm: record.desc_alm,
          medcod: record.medcod,
          codigo_sig: record.codigo_sig,
          xnom: record.xnom,
          lote: record.lote,
          fecha: record.fecha,
          medregsan: record.medregsan,
          tipsum: record.tipsum,
          tipsum_des: record.tipsum_des,
          ffinan: record.ffinan,
          ffinan_des: record.ffinan_des,
          saldo: record.saldo,
          precio_det: record.precio_det,
          preciocab: record.preciocab,
          fecha_equipo: record.fecha_equipo || fecha_equipo,
        });
      } else {
        invalidIncomingAlmcods.add(recAlmcod);
      }
    }

    // 7. Crear un sync_run con status processing
    const hasSecurityAlert = invalidIncomingAlmcods.size > 0;
    const securityErrorMessage = hasSecurityAlert 
      ? `ALERTA DE SEGURIDAD: Se rechazaron registros por pertenecer a almacenes no autorizados: ${Array.from(invalidIncomingAlmcods).join(", ")}`
      : null;

    const { data: syncRun, error: runError } = await supabase
      .from('sync_runs')
      .insert({
        installation_id: installation.id,
        facility_code: facilityCode,
        mode: mode || 'detallado', // detallado recomendado
        record_count: cleanedRecords.length,
        fecha_equipo: fecha_equipo,
        status: 'processing',
        error_message: securityErrorMessage
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Error creando sync_run: ${runError.message}`);
    }

    // Deduplicar registros sumando saldos por llave única: almcod + medcod + lote + fecha + ffinan + tipsum
    const dedupedMap = new Map<string, any>();
    for (const rec of cleanedRecords) {
      const key = `${rec.almcod}|${rec.medcod}|${rec.lote || ''}|${rec.fecha || ''}|${rec.ffinan || ''}|${rec.tipsum || ''}`;
      if (dedupedMap.has(key)) {
        const existing = dedupedMap.get(key);
        existing.saldo = (Number(existing.saldo) || 0) + (Number(rec.saldo) || 0);
      } else {
        dedupedMap.set(key, { ...rec });
      }
    }
    const finalRecords = Array.from(dedupedMap.values());

    try {
      const incomingAlmcodList = Array.from(validIncomingAlmcods);
      
      if (incomingAlmcodList.length > 0) {
        // Borrar stock previo únicamente de los ALMCOD válidos enviados para este establecimiento
        const { error: delError } = await supabase
          .from('stock_actual')
          .delete()
          .eq('facility_code', facilityCode)
          .in('almcod', incomingAlmcodList);
          
        if (delError) {
           throw new Error(`Error borrando stock_actual previo: ${delError.message}`);
        }
      }

      // 9. Insertar los registros nuevos
      if (finalRecords.length > 0) {
          const chunkSize = 1000;
          for (let i = 0; i < finalRecords.length; i += chunkSize) {
            const chunk = finalRecords.slice(i, i + chunkSize);
            const { error: insError } = await supabase.from('stock_actual').insert(chunk);
            if (insError) throw new Error(`Error insertando registros: ${insError.message}`);
          }
      }

      // 10. Actualizar sync_runs con status success/warning
      await supabase
        .from('sync_runs')
        .update({ 
          status: hasSecurityAlert ? 'warning' : 'success', 
          finished_at: new Date().toISOString(),
          record_count: finalRecords.length
        })
        .eq('id', syncRun.id);

      // 11. Actualizar sync_installations con last_seen_at, toolkit_version, paths y ALMCODs detectados
      const previousDetected = installation.detected_almcods || [];
      const updatedDetected = Array.from(new Set([...previousDetected, ...incomingAlmcodList]));

      await supabase
        .from('sync_installations')
        .update({ 
          last_seen_at: new Date().toISOString(),
          toolkit_version: toolkit_version || installation.toolkit_version,
          last_sismed_path: newLastSismedPath,
          path_changed_at: newPathChangedAt,
          detected_almcods: updatedDetected
        })
        .eq('id', installation.id);

      // 12. Devolver JSON indicando estado final
      return new Response(JSON.stringify({ 
        success: true, 
        sync_run_id: syncRun.id, 
        records_processed: finalRecords.length,
        rejected_almcods: Array.from(invalidIncomingAlmcods),
        has_alerts: hasSecurityAlert
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (processError: any) {
      await supabase
        .from('sync_runs')
        .update({ 
           status: 'failed', 
           error_message: securityErrorMessage 
             ? `${securityErrorMessage}. Error proceso: ${processError.message}` 
             : processError.message,
           finished_at: new Date().toISOString() 
        })
        .eq('id', syncRun.id);
        
      throw processError;
    }

  } catch (error: any) {
    console.error('Error procesando sync-stock:', error.message);
    return new Response(JSON.stringify({ error: 'Error Interno del Servidor', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
