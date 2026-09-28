export function getNameInitial(name?: string | null, fallback = '피') {
  return name?.trim().slice(0, 1) || fallback;
}
