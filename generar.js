const fs = require('fs');

// Función auxiliar para forzar una pausa en milisegundos
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchConReintentos(url, opciones, reintentosMaximos = 3, retrasoInicial = 3000) {
    for (let intento = 1; intento <= reintentosMaximos; intento++) {
        try {
            // Creamos un controlador para definir nuestro propio límite de tiempo extendido
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 segundos de margen

            const respuesta = await fetch(url, {
                ...opciones,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            if (!respuesta.ok) throw new Error(`Código de estado HTTP: ${respuesta.status}`);
            return await respuesta.json();

        } catch (error) {
            console.warn(`⚠️ Intento ${intento} fallido. Motivo: ${error.message}`);
            if (intento === reintentosMaximos) throw error;
            
            const tiempoEspera = retrasoInicial * intento;
            console.log(`Esperando ${tiempoEspera / 1000} segundos antes de reintentar...`);
            await esperar(tiempoEspera);
        }
    }
}

async function ejecutar() {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActualNum = String(hoy.getMonth() + 1).padStart(2, '0');
    const monthEventParam = `${anioActual}-${mesActualNum}`;
    const startParam = `${anioActual}-${mesActualNum}-01`;

    const finMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);
    const endParam = `${finMesSiguiente.getFullYear()}-${String(finMesSiguiente.getMonth() + 1).padStart(2, '0')}-${String(finMesSiguiente.getDate()).padStart(2, '0')}`;

    console.log(`Iniciando descarga dinámica: ${startParam} hasta ${endParam}`);

    const dataRaw = new URLSearchParams({
        'event_cat_id': '',
        'month_event': monthEventParam,
        'start': startParam,
        'end': endParam
    });

    try {
        // Lanzamos la petición usando el motor robusto de reintentos
        const eventsData = await fetchConReintentos('https://vicalvablog.com', {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'es-ES,es;q=0.9',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'origin': 'https://vicalvablog.com',
                'referer': 'https://vicalvablog.com',
                // Modificamos el User-Agent para camuflar la petición como un navegador real actualizado
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: dataRaw
        });

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
            console.log(`🎉 ¡Éxito! Se procesaron ${eventsData.length} eventos culturales.`);
        } else {
            console.log('⚠️ Respuesta recibida vacía o sin estructura de eventos estándar.');
        }

        icsContent.push('END:VCALENDAR');
        fs.writeFileSync('agenda.ics', icsContent.join('\r\n'), 'utf8');
        console.log('Fichero agenda.ics actualizado en el repositorio local.');

    } catch (error) {
        console.error('❌ Error crítico insalvable tras los reintentos:', error.message);
        process.exit(1);
    }
}

ejecutar();
