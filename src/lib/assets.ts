export function getSvgSrc(asset: string | { src: string }) {
  return typeof asset === 'string' ? asset : asset.src;
}
