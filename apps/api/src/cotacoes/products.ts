// Produtos acompanhados no painel de cotações, com a unidade usada no campo.
//
// A CONAB publica o preço na coluna `valor_produto_kg`, em R$ por kg na maioria dos produtos (mas não
// em todos: ovos vêm por unidade). Por isso só mostramos esta lista conferida, e cada produto diz como
// converter: valor exibido = valor da CONAB × factor. Ex.: boi gordo R$ 25,22/kg × 15 = R$ 378,30/@.
// Nomes da CONAB exatamente como no arquivo (maiúsculas, com acento na classificação).

export interface TrackedProduct {
  key: string;
  label: string;
  conab: { name: string; class: string };
  unit: string; // como aparece na tela
  factor: number; // multiplica o valor por kg da CONAB
  note?: string;
}

export const TRACKED_PRODUCTS: TrackedProduct[] = [
  { key: 'BOI_GORDO', label: 'Boi gordo', conab: { name: 'BOI', class: 'GORDO' }, unit: 'R$/@', factor: 15, note: '1 arroba = 15 kg de carcaça.' },
  { key: 'LEITE', label: 'Leite in natura', conab: { name: 'LEITE DE VACA', class: 'IN NATURA' }, unit: 'R$/kg', factor: 1, note: '1 kg de leite equivale a cerca de 0,97 L.' },
  { key: 'MILHO', label: 'Milho em grão', conab: { name: 'MILHO', class: 'EM GRÃOS' }, unit: 'R$/sc 60 kg', factor: 60 },
  { key: 'SOJA', label: 'Soja em grão', conab: { name: 'SOJA', class: 'EM GRÃOS' }, unit: 'R$/sc 60 kg', factor: 60 },
  { key: 'ARROZ_CASCA', label: 'Arroz em casca', conab: { name: 'ARROZ', class: 'LONGO FINO EM CASCA' }, unit: 'R$/sc 50 kg', factor: 50 },
  { key: 'FEIJAO_CAUPI', label: 'Feijão-caupi', conab: { name: 'FEIJAO', class: 'CAUPI' }, unit: 'R$/sc 60 kg', factor: 60 },
  { key: 'MANDIOCA', label: 'Raiz de mandioca (para farinha)', conab: { name: 'RAIZ DE MANDIOCA', class: 'PARA FARINHA' }, unit: 'R$/t', factor: 1000 },
  { key: 'FARINHA_MANDIOCA', label: 'Farinha de mandioca', conab: { name: 'FARINHA DE MANDIOCA', class: 'MÉDIA SECA' }, unit: 'R$/kg', factor: 1 },
  { key: 'ACAI', label: 'Açaí (fruto)', conab: { name: 'ACAI', class: 'FRUTO' }, unit: 'R$/kg', factor: 1 },
  { key: 'CACAU', label: 'Cacau', conab: { name: 'CACAU CULTIVADO', class: 'NÃO INFORMADO' }, unit: 'R$/kg', factor: 1 },
  { key: 'PIMENTA_REINO', label: 'Pimenta-do-reino', conab: { name: 'PIMENTA DO REINO', class: 'NÃO INFORMADO' }, unit: 'R$/kg', factor: 1 },
];

export const PRODUCT_BY_KEY = new Map(TRACKED_PRODUCTS.map((p) => [p.key, p]));

export const convert = (product: TrackedProduct, valuePerKg: number) => Math.round(valuePerKg * product.factor * 100) / 100;
