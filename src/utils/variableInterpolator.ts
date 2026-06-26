/* export function interpolateVariables(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{\$\{(\w+)\}\}\}/g, (match, key) => {
        return variables[key] || match;
    })
}; */

/* export function interpolateVariables(text: string, variables: Record<string, string>): string {  
  console.log('🔍 Interpolating variables:', { text, variables }); // AGREGAR ESTE CLG  
    
  const result = text.replace(/\{\{(\w+)\}\}/g, (match, key) => {  
    const replacement = variables[key] || match;  
    console.log('🔄 Replacing:', { match, key, replacement }); // AGREGAR ESTE CLG  
    return replacement;  
  });  
    
  console.log('✅ Final result:', result); // AGREGAR ESTE CLG  
  return result;  
} */

export function interpolateVariables(text: string, variables: Record<string, string>): string {
/*     console.log('🔍 Interpolating variables:', { text, variables });
    console.log('🔍 Variables keys:', Object.keys(variables)); // AGREGAR ESTE LOG  
    console.log('🔍 Variables values:', Object.values(variables)); // AGREGAR ESTE LOG   */

    const result = text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const replacement = variables[key];
        if (replacement === undefined) return match;
        // Escape $ to prevent String.replace() treating values like $1/$& as backreferences
        return String(replacement).replace(/\$/g, '$$$$');
    });

    /* console.log('✅ Final result:', result); */
    return result;
}