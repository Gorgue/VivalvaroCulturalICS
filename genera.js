const fs = require('fs');

async function ejecutar() {
    // Parámetros POST requeridos
    const dataRaw = new URLSearchParams({
        'event_cat_id': '',
        'month_event': '2026-07',
        'start': '2026-06-29',
        'end': '2026-08-10'
    });

    try {
        const response = await fetch('https://vicalvablog.com', {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'es-ES,es;q=0.9',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'origin': 'https://vicalvablog.com',
                'referer': 'https://vicalvablog.com',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: dataRaw
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const eventsData = await response.json();

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Suscripcion Estatica//Agenda Vicalvaro//ES',
            'X-WR-CALNAME:Cultura Vicálvaro', // Nombre que verá Google Calendar
            'X-WR-TIMEZONE:Europe/Madrid',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        eventsData.forEach((event, index) => {
            const cleanStart = (event.start || '').replace(/[-:]/g, '');
            const cleanEnd = (event.end || '').replace(/[-:]/g, '') || cleanStart;
            
            icsContent.push('BEGIN:VEVENT');
            icsContent.push(`UID:vicalvaro-${index}-${cleanStart}@estatico`);
            icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
            icsContent.push(`DTSTART:${cleanStart}`);
            icsContent.push(`DTEND:${cleanEnd}`);
            icsContent.push(`SUMMARY:${event.title || 'Evento'}`);
            icsContent.push(`DESCRIPTION:${event.description || ''}`);
            if (event.location) icsContent.push(`LOCATION:${event.location}`);
            icsContent.push('END:VEVENT');
        });

        icsContent.push('END:VCALENDAR');
        
        // Escribe el archivo .ics físicamente en tu carpeta raíz estática
        fs.writeFileSync('agenda.ics', icsContent.join('\r\n'), 'utf8');
        console.log('¡Archivo agenda.ics generado con éxito!');

    } catch (error) {
        console.error('Error generando el calendario:', error);
        process.exit(1);
    }
}

ejecutar();
