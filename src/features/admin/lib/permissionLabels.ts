type Translate = (key: string) => string;

/**
 * Plain names for the permission codes the backend lists (GET /permissions): `permission.<Code>` and
 * `permission.<Code>.description`, `permissionGroup.<Group>` in locale.ts. A code without a name (a permission added on
 * the backend before the FE knows it) shows as itself, so it can still be ticked.
 *
 * `translate` returns the key itself when no locale has it (the active locale is tried first, then Vietnamese), so a
 * result equal to the key means "no name".
 */
const named = (key: string, fallback: string, t: Translate) => {
  const text = t(key);
  return text === key ? fallback : text;
};

export const permissionLabel = (code: string, t: Translate) => named(`permission.${code}`, code, t);
export const permissionDescription = (code: string, t: Translate) => named(`permission.${code}.description`, "", t);
export const permissionGroupLabel = (group: string, t: Translate) => named(`permissionGroup.${group}`, group, t);
