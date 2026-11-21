/// Busca sem acento e sem caixa alta ("Joao" acha "João").
String normalizeForSearch(String input) {
  const Map<String, String> map = {
    'á': 'a',
    'à': 'a',
    'â': 'a',
    'ã': 'a',
    'ä': 'a',
    'é': 'e',
    'è': 'e',
    'ê': 'e',
    'ë': 'e',
    'í': 'i',
    'ì': 'i',
    'î': 'i',
    'ï': 'i',
    'ó': 'o',
    'ò': 'o',
    'ô': 'o',
    'õ': 'o',
    'ö': 'o',
    'ú': 'u',
    'ù': 'u',
    'û': 'u',
    'ü': 'u',
    'ç': 'c',
    'ñ': 'n',
  };
  final StringBuffer out = StringBuffer();
  for (final int rune in input.toLowerCase().runes) {
    final String ch = String.fromCharCode(rune);
    out.write(map[ch] ?? ch);
  }
  return out.toString();
}

/// Só os dígitos do CPF.
String cpfDigits(String input) => input.replaceAll(RegExp(r'\D'), '');

/// CPF nunca completo na tela (mesmo formato da API): ***.456.789-**
String maskCpf(String digits) {
  if (digits.length != 11) return '***.***.***-**';
  return '***.${digits.substring(3, 6)}.${digits.substring(6, 9)}-**';
}

/// Valida os dígitos verificadores do CPF.
bool isValidCpf(String input) {
  final String d = cpfDigits(input);
  if (d.length != 11 || RegExp(r'^(\d)\1+$').hasMatch(d)) return false;
  int check(int length) {
    int sum = 0;
    for (int i = 0; i < length; i++) {
      sum += int.parse(d[i]) * (length + 1 - i);
    }
    final int rest = (sum * 10) % 11;
    return rest == 10 ? 0 : rest;
  }

  return check(9) == int.parse(d[9]) && check(10) == int.parse(d[10]);
}

/// Data no formato AAAA-MM-DD (o que a API espera em `visitedOn`, `returnOn`, `scheduledFor`).
String dayString(DateTime value) {
  final String y = value.year.toString().padLeft(4, '0');
  final String m = value.month.toString().padLeft(2, '0');
  final String d = value.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

/// Data para exibir: 20/11/2026.
String displayDay(String? iso) {
  if (iso == null || iso.length < 10) return '';
  final List<String> p = iso.substring(0, 10).split('-');
  return '${p[2]}/${p[1]}/${p[0]}';
}
