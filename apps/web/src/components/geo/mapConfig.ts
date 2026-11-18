import { baseMapStyle } from '@agrointegra/map-styles';

// Configuração do mapa vinda do .env (NEXT_PUBLIC_*: vai para o navegador, nunca ponha segredo aqui).
// Padrões: satélite Esri World Imagery + rótulos, centro em Canaã dos Carajás (PA), município do piloto.

const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Imagens © Esri, Maxar, Earthstar Geographics e comunidade de usuários GIS';

function parseCenter(raw: string | undefined): [number, number] {
  const parts = (raw ?? '').split(',').map((v) => Number(v.trim()));
  return parts.length === 2 && parts.every(Number.isFinite) ? [parts[0], parts[1]] : [-49.8786, -6.4966];
}

const labels = process.env.NEXT_PUBLIC_MAP_LABELS_URL;

export const MAP_CONFIG = {
  satelliteUrl: process.env.NEXT_PUBLIC_MAP_SATELLITE_URL || ESRI_IMAGERY,
  satelliteAttribution: process.env.NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION || ESRI_ATTRIBUTION,
  // Vazio = padrão Esri; "none" = sem camada de rótulos.
  labelsUrl: labels === 'none' ? undefined : labels || ESRI_LABELS,
  center: parseCenter(process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER), // [lng, lat]
  zoom: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM) || 11,
  // Zoom máximo das imagens. Acima dele o mapa amplia a última imagem em vez de pedir uma que o
  // provedor não tem (a Esri devolve "Map data not yet available" em áreas rurais do Pará).
  satelliteMaxZoom: Number(process.env.NEXT_PUBLIC_MAP_SATELLITE_MAXZOOM) || 17,
};

// SEMPRE o mesmo objeto: se o react-map-gl receber um estilo novo a cada renderização, ele reaplica
// o estilo e apaga as camadas que o terra-draw adicionou (o desenho some da tela).
let cachedStyle: ReturnType<typeof baseMapStyle> | null = null;
export const mapStyle = () =>
  (cachedStyle ??= baseMapStyle({
    satelliteUrl: MAP_CONFIG.satelliteUrl,
    satelliteAttribution: MAP_CONFIG.satelliteAttribution,
    labelsUrl: MAP_CONFIG.labelsUrl,
    maxZoom: MAP_CONFIG.satelliteMaxZoom,
  }));
