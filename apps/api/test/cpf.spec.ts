import { isValidCpf, maskCpf, onlyDigits } from '../src/common/cpf';
import { normalizeSearch } from '../src/common/search';
import { makeCpf } from './fixtures';

describe('CPF', () => {
  it('aceita CPF com dígitos verificadores corretos, com ou sem pontuação', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('recusa dígito verificador errado, tamanho errado e números repetidos', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('1234567890')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('o gerador de testes produz CPFs válidos e diferentes', () => {
    const a = makeCpf(1);
    const b = makeCpf(2);
    expect(isValidCpf(a)).toBe(true);
    expect(isValidCpf(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('mascara no formato ***.456.789-**', () => {
    expect(maskCpf('12345678909')).toBe('***.456.789-**');
  });

  it('onlyDigits remove pontuação', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725');
  });
});

describe('Busca', () => {
  it('ignora maiúsculas, acentos e espaços extras', () => {
    expect(normalizeSearch('  José  da   CONCEIÇÃO ')).toBe('jose da conceicao');
  });
});
