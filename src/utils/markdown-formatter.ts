export interface TextFormat {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
}

/**
 * Normaliza los formatos de manera más inteligente, preservando la intención del usuario
 */
function normalizeFormats(text: string, formats: TextFormat[]): TextFormat[] {
  return formats
    .map(format => {
      let { start, end, ...rest } = format;
      
      // Validar rango básico
      if (start < 0 || end > text.length || start >= end) {
        return null;
      }

      // Ajustar bordes para excluir espacios, pero preservar la intención del formato
      const originalStart = start;
      const originalEnd = end;
      
      // Mover inicio hasta encontrar un carácter no-espacio
      while (start < end && text[start].trim() === '') {
        start++;
      }
      
      // Mover fin hacia atrás hasta encontrar un carácter no-espacio
      while (end > start && text[end - 1].trim() === '') {
        end--;
      }
      
      // Si después de quitar espacios el formato queda vacío, lo descartamos
      if (start >= end) {
        return null;
      }
      
      // Preservar el formato si el usuario claramente quería incluir los espacios
      // (si el formato original incluía texto no-espacio)
      const hasNonSpaceContent = text
        .substring(originalStart, originalEnd)
        .trim().length > 0;
      
      if (!hasNonSpaceContent) {
        return null;
      }
      
      return { start, end, ...rest };
    })
    .filter((format): format is TextFormat => format !== null);
}

/**
 * Algoritmo de eventos mejorado para manejar formatos superpuestos
 */
export function textWithFormatsToMarkdown(text: string, formats: TextFormat[]): string {  
  if (!formats || formats.length === 0) return text;
  
  const normalizedFormats = normalizeFormats(text, formats);
  if (normalizedFormats.length === 0) return text;
  
  // Crear eventos de manera más eficiente
  const events: Array<{
    position: number; 
    type: 'start' | 'end'; 
    formatType: 'bold' | 'italic';
  }> = [];
  
  normalizedFormats.forEach(format => {
    if (format.bold) {
      events.push(
        { position: format.start, type: 'start', formatType: 'bold' },
        { position: format.end, type: 'end', formatType: 'bold' }
      );
    }
    if (format.italic) {
      events.push(
        { position: format.start, type: 'start', formatType: 'italic' },
        { position: format.end, type: 'end', formatType: 'italic' }
      );
    }
  });
  
  // Ordenar eventos: por posición y end antes de start en misma posición
  events.sort((a, b) => 
    a.position !== b.position ? a.position - b.position : 
    a.type === 'end' ? -1 : 1
  );
  
  let result = '';
  let currentPosition = 0;
  const activeFormats: Set<'bold' | 'italic'> = new Set();
  
  // Procesar cada evento
  for (const event of events) {
    // Añadir texto hasta el evento
    if (event.position > currentPosition) {
      result += text.substring(currentPosition, event.position);
      currentPosition = event.position;
    }
    
    if (event.type === 'start') {
      activeFormats.add(event.formatType);
      result += event.formatType === 'bold' ? '**' : '*';
    } else {
      activeFormats.delete(event.formatType);
      result += event.formatType === 'bold' ? '**' : '*';
    }
  }
  
  // Añadir texto restante
  if (currentPosition < text.length) {
    result += text.substring(currentPosition);
  }
  
  return result;
}

/**
 * Algoritmo robusto mejorado para formatos no superpuestos
 */
export function textWithFormatsToMarkdownRobust(text: string, formats: TextFormat[]): string {
  if (!formats || formats.length === 0) return text;
  
  const normalizedFormats = normalizeFormats(text, formats);
  if (normalizedFormats.length === 0) return text;
  
  // Ordenar formatos por posición de inicio (de mayor a menor para inserción segura)
  const sortedFormats = [...normalizedFormats]
    .filter(fmt => fmt.start >= 0 && fmt.end <= text.length && fmt.start < fmt.end)
    .sort((a, b) => b.start - a.start); // Orden descendente para inserción
  
  let result = text;
  
  for (const format of sortedFormats) {
    const start = format.start;
    const end = format.end;
    const content = result.substring(start, end);
    
    // Solo aplicar formato si hay contenido
    if (!content.trim()) continue;
    
    let markers = '';
    if (format.bold && format.italic) markers = '***';
    else if (format.bold) markers = '**';
    else if (format.italic) markers = '*';
    
    if (markers) {
      result = 
        result.substring(0, start) + 
        markers + content + markers + 
        result.substring(end);
    }
  }
  
  return result;
}

/**
 * Función principal inteligente que elige el mejor algoritmo
 */
export function formatTextToMarkdown(text: string, formats: TextFormat[]): string {
  // Casos rápidos
  if (!text) return text;
  if (!formats || formats.length === 0) return text;
  
  const normalizedFormats = normalizeFormats(text, formats);
  if (normalizedFormats.length === 0) return text;
  
  // Elegir algoritmo basado en complejidad
  const hasOverlappingFormats = checkForOverlappingFormats(normalizedFormats);
  const totalFormatsLength = normalizedFormats.reduce((sum, fmt) => sum + (fmt.end - fmt.start), 0);
  
  // Usar algoritmo robusto para casos simples, eventos para casos complejos
  if (hasOverlappingFormats || totalFormatsLength > text.length * 0.5) {
    return textWithFormatsToMarkdown(text, normalizedFormats);
  } else {
    return textWithFormatsToMarkdownRobust(text, normalizedFormats);
  }
}

/**
 * Detección mejorada de formatos superpuestos
 */
function checkForOverlappingFormats(formats: TextFormat[]): boolean {
  // Ordenar por posición de inicio
  const sorted = [...formats].sort((a, b) => a.start - b.start);
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    
    // Si el formato anterior termina después de que el actual empieza, hay superposición
    if (prev.end > curr.start) {
      return true;
    }
  }
  
  return false;
}

/**
 * Función de debug mejorada
 */
export function debugFormats(text: string, formats: TextFormat[]): void {
  console.group('🔍 Debug de Formatos');
  console.log('Texto completo:', JSON.stringify(text));
  console.log('Longitud del texto:', text.length);
  console.log('Número de formatos:', formats.length);
  
  formats.forEach((fmt, index) => {
    const content = text.substring(fmt.start, fmt.end);
    console.log(
      `Formato ${index}: "${content}" [${fmt.start}-${fmt.end}]`,
      { 
        bold: fmt.bold, 
        italic: fmt.italic,
        length: content.length,
        hasSpaces: content.includes(' '),
        trimmed: content.trim().length
      }
    );
  });
  
  // Mostrar formatos normalizados para comparación
  const normalized = normalizeFormats(text, formats);
  console.log('Formatos después de normalizar:', normalized.length);
  console.groupEnd();
}

/**
 * Utilidad para validar formatos (útil en desarrollo)
 */
export function validateFormats(text: string, formats: any[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  formats.forEach((format, index) => {

    const validateFormatKeys = ['bold', 'italic', 'underline', 'strike', 'code', 'sub', 'sup', 'color', 'background', "fontSize"];
    const hasValidFormat = validateFormatKeys.some(key => format[key] !== undefined);
    
    if (!hasValidFormat) {
      errors.push(`Formato ${index}: sin formato válido`);  
    }

    if (format.start < 0 || format.end > text.length || format.start >= format.end) {  
      errors.push(`Formato ${index}: rango inválido (${format.start}-${format.end})`);  
    }  
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}