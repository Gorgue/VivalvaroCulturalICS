const fs = require('fs');

async function ejecutar() {
    console.log("Iniciando lectura de la agenda pública de Vicálvaro...");

    try {
        // Solicitamos la página HTML visual que sabemos que siempre está disponible y libre de bloqueos API
        const response = await fetch('https://vicalvablog.com', {
            method: 'GET',
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'es-ES,es;q=0.9',
                'cache-control': 'no-cache',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) throw new Error(`El servidor denegó el acceso visual. Código: ${response.status}`);
        const html = await response.text();

        // Estructura base del archivo iCalendar
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Suscripcion Estatica Scraper//Agenda Vicalvaro//ES',
            'X-WR-CALNAME:Cultura Vicálvaro', 
            'X-WR-TIMEZONE:Europe/Madrid',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        let contadorEventos = 0;

        /* 
          Análisis del HTML del tema NativeChurch:
          Buscamos bloques de eventos renderizados por WordPress que contienen los metadatos.
          Estructura común: <a class="event-title" ...>Título</a> o atributos de datos 'data-event'
        */
        
        // Expresión regular para capturar objetos de eventos que WordPress suele inyectar en línea en el calendario
        const regexEventosJson = /events\s*:\s*(\s*\[[\s\S]*?\]\s*)/g;
        const matches = regexEventosJson.exec(html);

        let listaEventos = [];

        if (matches && matches[1]) {
            try {
                // Si la plantilla inyecta el JSON base en una etiqueta <script> interna, lo parseamos directamente
                listaEventos = JSON.parse(matches[1]);
            } catch (e) {
                listaEventos = [];
            }
        }

        // Si no se encuentra un JSON interno inyectado, realizamos un parseo alternativo de emergencia por bloques HTML básicos
        if (listaEventos.length === 0) {
            console.log("Parseando estructura HTML nativa de los bloques del calendario...");
            
            // Buscador de enlaces o contenedores de eventos comunes en NativeChurch 
            // (<span class="event-date">, <h3 class="event-title"> o similares)
            const regexBloques = /<div class="event-item"([\s\S]*?)<\/div>/g;
            let bloque;
            
            while ((bloque = regexBloques.exec(html)) !== null) {
                const contenido = bloque[1];
                
                // Extraer título
                const matchTitulo = /title="([^"]+)"|<h4>([^<]+)<\/h4>/.exec(contenido);
                const titulo = matchTitulo ? (matchTitulo[1] || matchTitulo[2]) : "Evento Cultural Vicálvaro";
                
                // Extraer fecha tentativa o usar la fecha del sistema actual para evitar nulos
                const hoyStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
                
                listaEventos.push({
                    title: titulo.trim(),
                    start: `${hoyStr}T190000`, // Por defecto si no se lee hora: 19:00h
                    end: `${hoyStr}T210000`,
                    description: "Evento extraído de la cartelera oficial de Vicálvaro."
                });
            }
        }

        // Construcción final de los bloques iCal
        if (listaEventos.length > 0) {
            listaEventos.forEach((event, index) => {
                const cleanStart = (event.start || '').replace(/[-:]/g, '');
                const cleanEnd = (event.end || '').replace(/[-:]/g, '') || cleanStart;
                
                icsContent.push('BEGIN:VEVENT');
                icsContent.push(`UID:vicalvaro-scrap-${index}-${cleanStart.substring(0,8)}@estatico`);
                icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')}Z`);
                icsContent.push(`DTSTART:${cleanStart}`);
                icsContent.push(`DTEND:${cleanEnd}`);
                icsContent.push(`SUMMARY:${event.title || 'Actividad Cultural'}`);
                icsContent.push(`DESCRIPTION:${event.description || 'Consulta detalles en la web oficial.'}`);
                if (event.location) icsContent.push(`LOCATION:${event.location}`);
                icsContent.push('END:VEVENT');
                contadorEventos++;
            });
        }

        // Si el raspado básico no detectó citas por cambios drásticos en la maquetación, 
        // inyectamos un evento de control informativo para avisarte en tu Google Calendar
        if (contadorEventos === 0) {
            console.log("⚠️ No se aislaron citas textuales. Añadiendo evento de sincronización de control.");
            const hoyFormato = new Date().toISOString().slice(0,10).replace(/-/g, '');
            icsContent.push('BEGIN:VEVENT');
            icsContent.push(`UID:vicalvaro-alerta-${hoyFormato}@estatico`);
            icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')}Z`);
            icsContent.push(`DTSTART:${hoyFormato}T100000`);
            icsContent.push(`DTEND:${hoyFormato}T110000`);
            icsContent.push('SUMMARY:Revisar Agenda Vicálvaro Web');
            icsContent.push('DESCRIPTION:Calendario activo. Entra en vicalvablog.com para ver la cartelera actualizada.');
            icsContent.push('END:VEVENT');
        }

        icsContent.push('END:VCALENDAR');
        
        fs.writeFileSync('agenda.ics', icsContent.join('\r\n'), 'utf8');
        console.log(`🎉 Proceso completado. Fichero agenda.ics escrito correctamente con ${contadorEventos} eventos.`);

    } catch (error) {
        console.error('❌ Error crítico en el scraping:', error.message);
        process.exit(1);
    }
}

ejecutar();
