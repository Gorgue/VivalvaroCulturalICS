const fs = require('fs');

async function ejecutar() {
    // 1. Calcular de forma dinámica el mes actual y el siguiente
    const hoy = new Date();
    
    // Año y mes actual (Formato: YYYY-MM)
    const anioActual = hoy.getFullYear();
    const mesActualNum = String(hoy.getMonth() + 1).padStart(2, '0');
    const monthEventParam = `${anioActual}-${mesActualNum}`;

    // Fecha de inicio: Primer día del mes actual (Formato: YYYY-MM-DD)
    const startParam = `${anioActual}-${mesActualNum}-01`;

    // Fecha de fin: Último día del mes siguiente
    // Al poner el mes + 2 y el día 0, JavaScript nos da el último día del mes siguiente
    const finMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);
    const anioSiguiente = finMesSiguiente.getFullYear();
    const mesSiguienteNum = String(finMesSiguiente.getMonth() + 1).padStart(2, '0');
    const diaSiguienteNum = String(finMesSiguiente.getDate()).padStart(2, '0');
    const endParam = `${anioSiguiente}-${mesSiguienteNum}-${diaSiguienteNum}`;

    console.log(`Generando agenda dinámica desde ${startParam} hasta ${endParam}...`);

    // Parámetros POST dinámicos
    const dataRaw = new URLSearchParams({
        'event_cat_id': '',
        'month_event': monthEventParam,
        'start': startParam,
        'end': endParam
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
            'X-WR-CALNAME:Cultura Vicálvaro', 
            'X-WR-TIMEZONE:Europe/Madrid',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        if (Array.isArray(eventsData) && eventsData.length > 0) {
            eventsData.forEach((event, index) => {
                const cleanStart = (event.start || '').replace(/[-:]/g, '');
                const cleanEnd = (event.end || '').replace(/[-:]/g, '') || cleanStart;
                
                icsContent.push('BEGIN:VEVENT');
                icsContent.push(`UID:vicalvaro-${index}-${cleanStart}@estatico`);
                icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')}Z`);
                icsContent.push(`DTSTART:${cleanStart}`);
                icsContent.push(`DTEND:${cleanEnd}`);
                icsContent.push(`SUMMARY:${event.title || 'Evento'}`);
                icsContent.push(`DESCRIPTION:${event.description || ''}`);
                if (event.location) icsContent.push(`LOCATION:${event.location}`);
                icsContent.push('END:VEVENT');
            });
            console.log(`Se han procesado ${eventsData.length} eventos.`);
        } else {
            console.log('No se encontraron eventos en el servidor para este rango de fechas.');
        }

        icsContent.push('END:VCALENDAR');
        
        fs.writeFileSync('agenda.ics', icsContent.join('\r\n'), 'utf8');
        console.log('¡Archivo agenda.ics guardado correctamente!');

    } catch (error) {
        console.error('Error generando el calendario:', error);
        process.exit(1);
    }
}

ejecutar();
