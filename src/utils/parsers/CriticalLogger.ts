// CriticalLogger.ts
export class CriticalLogger {
    private static instance: CriticalLogger;
    private errorCount: number = 0;
    private warningCount: number = 0;

    // 🔥 NUEVO: Mapa para llevar la cuenta de advertencias repetidas
    // Key: "Mensaje::TagName", Value: Cantidad de veces
    private warningCounts: Map<string, number> = new Map();

    private static loggingEnabled: boolean = true;

    private constructor() {}

    static getInstance(): CriticalLogger {
        if (!CriticalLogger.instance) {
            CriticalLogger.instance = new CriticalLogger();
        }
        return CriticalLogger.instance;
    }

    static error(message: string, element?: Element, error?: any): void {
        if (!CriticalLogger.loggingEnabled) return;
        const logger = CriticalLogger.getInstance();
        logger.errorCount++;
        
        // Los errores críticos generalmente SÍ queremos verlos todos,
        // pero si quieres agruparlos también, avísame.
        // Por ahora lo dejo verbose para no ocultar fallos graves.
        
        console.log(
            `%c[PARSER CRITICAL] ${message}`,
            'color: red; font-weight: bold; background: yellow; padding: 2px;'
        );
        
        if (element) {
            console.log('Element:', {
                tag: element.tagName,
                id: element.id,
                classes: element.className,
                // Cortamos el HTML para no ensuciar la consola
                html: element.outerHTML.substring(0, 300) 
            });
        }
        
        if (error) {
            console.error('Error details:', error);
        }
    }

    static warning(message: string, element?: Element): void {
        if (!CriticalLogger.loggingEnabled) return;
        const logger = CriticalLogger.getInstance();
        logger.warningCount++;
        
        // 1. Generar una clave única para este tipo de advertencia
        const tag = element ? element.tagName.toUpperCase() : 'GLOBAL';
        const uniqueKey = `${message}::${tag}`;

        // 2. Obtener conteo actual
        const currentCount = logger.warningCounts.get(uniqueKey) || 0;

        // 3. Incrementar contador
        logger.warningCounts.set(uniqueKey, currentCount + 1);

        // 4. 🔥 LÓGICA DE SILENCIO: Solo imprimir la primera vez
        if (currentCount === 0) {
            console.log(
                `%c[PARSER WARNING] ${message}`,
                'color: orange; font-weight: bold;',
                element ? `<${tag}> (Se mostrará solo una vez por tipo de etiqueta)` : ''
            );
        } 
        // Si currentCount > 0, no hacemos console.warn, solo contamos.
    }

    // Con debug de bloques
/*     static warning(message: string, element?: Element): void {
        if (!CriticalLogger.loggingEnabled) return;
        const logger = CriticalLogger.getInstance();
        logger.warningCount++;
        
        const tag = element ? element.tagName.toUpperCase() : 'GLOBAL';
        const uniqueKey = `${message}::${tag}`;
        const currentCount = logger.warningCounts.get(uniqueKey) || 0;
        logger.warningCounts.set(uniqueKey, currentCount + 1);

        // 🔥 MODIFICACIÓN: Si verbose es true, mostramos TODO siempre.
        if (CriticalLogger.verbose || currentCount === 0) {
            console.log(
                `%c[PARSER WARNING] ${message} (${currentCount + 1})`,
                'color: orange; font-weight: bold;',
                element ? `<${tag} id="${element.id}" class="${element.className}">` : ''
            );
            
            // Imprimimos el elemento nativo del DOM para que puedas pasar el mouse 
            // sobre él en la consola y se ilumine en la pantalla (si aún existe en el DOM)
            if (element) console.log(element); 
        }
    } */

    static getStats(): { errors: number; warnings: number; uniqueWarnings: Record<string, number> } {
        const logger = CriticalLogger.getInstance();
        
        // Convertimos el Map a un objeto simple para verlo fácil en logs si se pide
        const uniqueWarnings: Record<string, number> = {};
        logger.warningCounts.forEach((value, key) => {
            uniqueWarnings[key] = value;
        });

        return {
            errors: logger.errorCount,
            warnings: logger.warningCount,
            uniqueWarnings // Para saber qué se ocultó
        };
    }

    static reset(): void {
        const logger = CriticalLogger.getInstance();
        logger.errorCount = 0;
        logger.warningCount = 0;
        logger.warningCounts.clear(); // 🔥 Limpiamos el mapa de duplicados
        
        if (CriticalLogger.loggingEnabled) {
            console.log('%c[LOGGER] Estadísticas reiniciadas', 'color: gray;');
        }
    }
}