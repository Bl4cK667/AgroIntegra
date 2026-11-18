// Tipos mínimos do shpjs 6 (o pacote não traz declarações).
declare module 'shpjs' {
  interface ShpFeatureCollection {
    type: 'FeatureCollection';
    fileName?: string;
    features: { type: 'Feature'; geometry: { type: string; coordinates: unknown } | null; properties: Record<string, unknown> | null }[];
  }
  export function parseZip(buffer: ArrayBuffer | Uint8Array, whiteList?: string[]): Promise<ShpFeatureCollection | ShpFeatureCollection[]>;
  export function getShapefile(base: ArrayBuffer | string, whiteList?: string[]): Promise<ShpFeatureCollection | ShpFeatureCollection[]>;
  export default getShapefile;
}
