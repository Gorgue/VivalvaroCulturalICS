const fs = require('fs');
const path = require('path');

async function ejecutar() {
    console.log("Iniciando extracción universal y dinámica del calendario...");
    
    const rutaHtml = path.join(__dirname, 'agenda_publica.html');
    
    if (!fs.existsSync(rutaHtml)) {
        console.error("❌ El archivo 'agenda_publica.html' no existe.");
        process.exit(1);
    }

    try {
        const html = fs.readFileSync(rutaHtml, 'utf8');

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Suscripcion Dinamica Pura//Agenda Vicalvaro//ES',
            'X-WR-CALNAME:Cultura Vicálvaro', 
            'X-WR-TIMEZONE:Europe/Madrid',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        let listaEventos = [];
        let contador = 0;

        // 1. Capturar el bloque de inicialización del calendario inyectado por WordPress
        const regexScriptEvents = /events\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])/i;
        const match = regexScriptEvents.exec(html);

        if (match && match) {
            try {
                // Normalización de sintaxis JS a JSON estricto
                let jsonTexto = match
                    .replace(/\/\/.*$/gm, '') 
                    .replace(/'/g, '"')       
                    .replace(/,(\s*[\}\]])/g, '$1'); 
                
                listaEventos = JSON.parse(jsonTexto);
            } catch (e) {
                listaEventos = [];
            }
        }

        // 2. Extractor de contingencia: Parsea las propiedades de forma dinámica e individualizada 
        // aislando cualquier propiedad presente en el objeto (sin importar el orden o contenido)
        if (listaEventos.length === 0 && match && match) {
            const regexBloqueEvento = /\{\s*([\s\S]*?)\s*\}/g;
            let subMatch;
            while ((subMatch = regexBloqueEvento.exec(match)) !== null) {
                const bloqueTexto = subMatch;
                
                const tMatch = /title\s*:\s*["']([^"']+)["']/i.exec(bloqueTexto);
                const sMatch = /start\s*:\s*["']([^"']+)["']/i.exec(bloqueTexto);
                const eMatch = /end\s*:\s*["']([^"']+)["']/i.exec(bloqueTexto);
                const uMatch = /url\s*:\s*["']([^"']+)["']/i.exec(bloqueTexto);
                const lMatch = /location\s*:\s*["']([^"']+)["']/i.exec(bloqueTexto);
                const dMatch = /description\s*:\s*["']([^"']+)["']/i.exec(bloqueTexto);

                if (tMatch && sMatch) {
                    listaEventos.push({
                        title: tMatch,
                        start: sMatch,
                        end: eMatch ? eMatch : sMatch,
                        url: uMatch ? uMatch : '',
                        location: lMatch ? lMatch : '',
                        description: dMatch ? dMatch : ''
                    });
                }
            }
        }

        // 3. Volcado de propiedades nativas al estándar iCalendar
        if (listaEventos.length > 0) {
            listaEventos.forEach((event) => {
                const cleanStart = (event.start || '').replace(/[- :]/g, '');
                let cleanEnd = (event.end || '').replace(/[- :]/g, '');
                
                if (!cleanStart) return; 
                if (!cleanEnd || cleanEnd === cleanStart) {
                    const horaInt = parseInt(cleanStart.substring(8, 12)) || 1900;
                    cleanEnd = cleanStart.substring(0, 8) + 'T' + String(horaInt + 2).padStart(4, '0') + '00';
                }

                const finalStart = cleanStart.includes('T') ? cleanStart : `${cleanStart}T190000`;
                const finalEnd = cleanEnd.includes('T') ? cleanEnd : `${cleanEnd}T210000`;

                // Construcción del nodo iCal basándose al 100% en los datos originales del servidor
                icsContent.push('BEGIN:VEVENT');
                icsContent.push(`UID:vicalvaro-wp-${contador}-${cleanStart.substring(0,8)}@estatico`);
                icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')}Z`);
                icsContent.push(`DTSTART:${finalStart}`);
                icsContent.push(`DTEND:${finalEnd}`);
                icsContent.push(`SUMMARY:${event.title || 'Actividad Cultural'}`);
                
                // Si el plugin sirve descripción nativa se concatena, si no se enlaza la URL web
                const descFinal = event.description ? event.description : `Detalles del evento en la web oficial: ${event.url || 'https://vicalvablog.com'}`;
                icsContent.push(`DESCRIPTION:${descFinal}`);
                
                // Mapeo directo de la localización nativa del plugin (El Madroño, Ferial, etc. vendrán aquí integrados)
                if (event.location) {
                    icsContent.push(`LOCATION:${event.location}`);
                }
                
                icsContent.push('END:VEVENT');
                contador++;
            });
            console.log(`🎉 Procesados con éxito ${contador} eventos basándose íntegramente en los metadatos del servidor.`);
        } else {
            // Evento técnico obligatorio para mantener viva la suscripción de Google Calendar si la web no publica nada
            const hoyStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
            icsContent.push('BEGIN:VEVENT');
            icsContent.push(`UID:vicalvaro-empty-${hoyStr}@estatico`);
            icsContent.push(`DTSTART:${hoyStr}T090000Z`);
            icsContent.push(`DTEND:${hoyStr}T100000Z`);
            icsContent.push('SUMMARY:Suscripción Agenda Vicálvaro');
            icsContent.push('DESCRIPTION:Calendario sincronizado correctamente. Sin eventos planificados en el portal para el periodo actual.');
            icsContent.push('END:VEVENT');
        }

        icsContent.push('END:VCALENDAR');
        fs.writeFileSync('agenda.ics', icsContent.join('\r\n'), 'utf8');

    } catch (error) {
        console.error('❌ Error en el procesamiento dinámico:', error.message);
        process.exit(1);
    }
}

ejecutar();
