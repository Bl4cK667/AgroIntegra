// Copia o web worker do MapLibre para public/maplibre/ (servido como arquivo estático).
// Motivo: a versão ESM do maplibre-gl 6 procura o worker ao lado do próprio arquivo
// (import.meta.url); depois do bundle do Next esse arquivo não existe e o mapa não desenha
// nenhuma camada GeoJSON. O componente aponta o MapLibre para cá com setWorkerUrl().
// Roda antes do `dev` e do `build` (predev/prebuild), sempre a partir da versão instalada.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs');
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'maplibre', 'maplibre-gl-worker.mjs');
mkdirSync(path.dirname(target), { recursive: true });
copyFileSync(source, target);
console.log('Worker do MapLibre copiado para public/maplibre/.');
