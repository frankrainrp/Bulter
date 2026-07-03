export function GetByPath(data: unknown, path?: string) {
  if (!path) return data;

  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

