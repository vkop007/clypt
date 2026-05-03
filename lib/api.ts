export const API_BASE: string =
  typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_BASE_PATH ?? '') : '';
