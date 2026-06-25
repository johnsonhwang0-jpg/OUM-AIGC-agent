export function applyPromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}|\\{${escapedKey}\\}`, "g"), value);
  }, template);
}
