const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    if (!(name in vars)) {
      throw new Error(`Missing variable: ${name}`);
    }
    return vars[name];
  });
}
