const fs = require('fs');
const path = require('path');

async function ejecutar() {
    console.log("Analizando la agenda pública de Vicálvaro...");
    
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
            'PRODID:-//Suscripcion HTML Scraper//Agenda Vicalvaro//ES',
            'X-WR-CALNAME:Cultura Vicálvaro', 
            'X-WR-TIMEZONE:Europe/Madrid',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        let contador = 0;
        const anioActual = new Date().getFullYear();

        // Expresión regular diseñada específicamente para capturar la lista de eventos del tema NativeChurch
        // Busca estructuras de tipo: * [Día] [Mes]. [Categoría]. [Título]. [Ubicación]
        const regexEventos = /<\s*li\s+class\s*=\s*"[^"]*listing-item[^"]*"[^>]*>([\s\S]*?)<\s*\/\s*li\s*>/gi;
        
        // Alternativa de parseo de texto por bloques de listas en caso de renderizado directo
        const bloquesHtml = html.match(/<li>([\s\S]*?)<\/li>/gi) || [];
        
        bloquesHtml.forEach((bloque, index) => {
            // Buscamos líneas que contengan las palabras clave del programa cultural de verano
            if (bloque.includes('CINE DE VERANO') || bloque.includes('NOCHES DE VICÁLVARO') || bloque.includes('TARDES FOLKIS')) {
                
                // Limpiamos etiquetas HTML para extraer el texto plano
                let textoLimpio = bloque.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                
                // Extraer título e información útil
                let titulo = "Actividad Cultural";
                if (textoLimpio.includes('CINE DE VERANO')) {
                    titulo = "Cine: " + textoLimpio.split('CINE DE VERANO')[1].split('.')[0].trim().replace(/[«»“”"]/g, '');
                } else if (textoLimpio.includes('NOCHES DE VICÁLVARO')) {
                    titulo = "Espectáculo: " + textoLimpio.split('NOCHES DE VICÁLVARO')[1].split('.')[0].trim().replace(/[«»“”"]/g, '');
                } else {
                    titulo = textoLimpio.substring(0, 50) + "...";
                }

                // Intentamos capturar la fecha del texto (ej: "10 Jul")
                let dia = "15";
                let mes = "07"; // Julio por defecto para la agenda estival
                
                const matchFecha = /(\d{1,2})\s+(Jul|Ago|Sep)/i.exec(textoLimpio);
                if (matchFecha) {
                    dia = matchFecha[1].padStart(2, '0');
                    const textoMes = matchFecha[2].toLowerCase();
                    if (textoMes.includes('ago')) mes = '08';
                    if (textoMes.includes('sep')) mes = '09';
                }

                // Definimos un horario estándar nocturno (22:00h - 23:59h) propio del ciclo de verano de Vicálvaro
                const fechaStart = `${anioActual}${mes}${dia}T200000Z`;
                const fechaEnd = `${anioActual}${mes}${dia}T220000Z`;

                icsContent.push('BEGIN:VEVENT');
                icsContent.push(`UID:vicalvaro-html-${index}-${dia}${mes}@estatico`);
                icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')}Z`);
                icsContent.push(`DTSTART:${fechaStart}`);
                icsContent.push(`DTEND:${fechaEnd}`);
                icsContent.push(`SUMMARY:${titulo}`);
                icsContent.push(`DESCRIPTION:${textoLimpio}`);
                
                // Extraer ubicación simplificada
                if (textoLimpio.includes('RECINTO FERIAL')) icsContent.push('LOCATION:Auditorio Recinto Ferial de Vicálvaro, Madrid');
                else if (textoLimpio.includes('CAÑAVERAL')) icsContent.push('LOCATION:IDB II El Cañaveral, Madrid');
                else if (textoLimpio.includes('VALDEBERNARDO')) icsContent.push('LOCATION:Parque Forestal de Valdebernardo, Madrid');
                
                icsContent.push('END:VEVENT');
                contador++;
            }
        });

        // Si no se encuentran eventos por un cambio estructural repentino, dejamos un evento base informativo
        if (contador === 0) {
            const hoyStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
            icsContent.push('BEGIN:VEVENT');
            icsContent.push(`UID:vicalvaro-info-${hoyStr}@estatico`);
            icsContent.push(`DTSTART:${hoyStr}T200000Z`);
            icsContent.push(`DTEND:${hoyStr}T210000Z`);
            icsContent.push('SUMMARY:Consultar Cartelera de Vicálvaro');
            icsContent.push('DESCRIPTION:Suscripción activa. Visita vicalvablog.com para comprobar las proyecciones y conciertos de esta semana.');
            icsContent.push('END:VEVENT');
            console.log("⚠️ Guardado archivo base informativo. No se aislaron cadenas de texto coincidentes.");
        }

        icsContent.push('END:VCALENDAR');
        fs.writeFileSync('agenda.ics', icsContent.join('\r\n'), 'utf8');
        console.log(`🎉 Proceso completado. Escritos ${contador} eventos en agenda.ics.`);

    } catch (error) {
        console.error('❌ Error procesando el archivo HTML:', error.message);
        process.exit(1);
    }
}

ejecutar();
