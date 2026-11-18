// Aponta o MapLibre para o worker servido em public/maplibre/ (copiado por scripts/copy-maplibre-worker.mjs).
// Sem isto, depois do bundle do Next o worker não é encontrado e nenhuma camada GeoJSON aparece.
// A versão na URL evita cache antigo quando o maplibre-gl for atualizado.
// Importe só em componentes client carregados com next/dynamic({ ssr: false }).
import { getVersion, setWorkerUrl } from 'maplibre-gl';

setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${getVersion()}`);
