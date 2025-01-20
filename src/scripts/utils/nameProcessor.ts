export function extractUniqueNames(peopleString: string): string[] {
    if (!peopleString) return [];
    
    // Split the string by commas and process each name
    return [...new Set(
      peopleString
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0)
    )].sort();
  }
  
  export function normalizeNames(names: string[]): string[] {
    return names.map(name => 
      name
        .toLowerCase()
        .split(' ')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    );
  }