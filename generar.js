const fs = require('fs');
const path = require('path');

async function ejecutar() {
    console.log("Leyendo el archivo de datos JSON local...");
    
    const rutaJson = path.join(__dirname, 'eventos_origen.json');
    
    if (!fs.existsSync(rutaJson)) {
        console.error("❌ El archivo fuente 'eventos_origen.json' no se ha generado en el paso anterior.");
        process.exit(1);
    }

    try {
        const contenidoRaw = fs.readFileSync(rutaJson, 'utf8');
        
        // Validamos si lo que devolvió curl es un HTML de error en vez de un JSON válido
        if (contenidoRaw.trim().startsWith('<!DOCTYPE')) {
            throw new Error("El servidor ha denegado el curl devolviendo una página de bloqueo web.");
        }

        const eventsData = JSON.parse(contenidoRaw);

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Suscripcion AJAX Local//Agenda Vicalvaro//ES',
            'X-WR-CALNAME:Cultura Vicálvaro', 
            'X-WR-TIMEZONE:Europe/Madrid',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        let contador = 0;

        if (Array.isArray(eventsData) && eventsData.length > 0) {
            eventsData.forEach((event, index) => {
                const cleanStart = (event.start || '').replace(/[-:]/g, '');
                const cleanEnd = (event.end || '').replace(/[-:]/g, '') || cleanStart;
                
                icsContent.push('BEGIN:VEVENT');
                icsContent.push(`UID:vicalvaro-ajax-${index}-${cleanStart.substring(0,8)}@estatico`);
                icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')}Z`);
                icsContent.push(`DTSTART:${cleanStart}`);
                icsContent.push(`DTEND:${cleanEnd}`);
                icsContent.push(`SUMMARY:${event.title || 'Actividad Cultural'}`);
                icsContent.push(`DESCRIPTION:${event.description || 'Consulta la agenda en vicalvablog.com'}`);
                if (event.location) icsContent.push(`LOCATION:${event.location}`);
                icsContent.push('END:VEVENT');
                contador++;
            });
            console.log(`🎉 ¡Éxito! Se han estructurado ${contador} eventos dinámicos obtenidos por AJAX.`);
        } else {
            console.log('⚠️ El JSON se ha descargado pero no contiene eventos para este periodo de fechas.');
        }

        icsContent.push('END:VCALENDAR');
        fs.writeFileSync('agenda.ics', icsContent.join('\r\n'), 'utf8');

    } catch (error) {
        console.error('❌ Error parseando los eventos del archivo local:', error.message);
        
        // Creamos un archivo de error limpio para evitar romper la suscripción de Google
        const hoyStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
        const errorIcs = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'X-WR-CALNAME:Cultura Vicálvaro (Alerta)',
            'BEGIN:VEVENT',
            `UID:vicalvaro-error-${hoyStr}@estatico`,
            `DTSTART:${hoyStr}T090000`,
            `DTEND:${hoyStr}T100000`,
            'SUMMARY:Incidencia en Sincronización',
            'DESCRIPTION:El servidor de origen no ha facilitado los datos JSON.',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');
        fs.writeFileSync('agenda.ics', errorIcs, 'utf8');
    }
}

ejecutar();
