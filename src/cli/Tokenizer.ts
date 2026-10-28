export class Tokenizer {
  tokenize(line: string): string[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: string[] = [];
    let token = '';
    let quoted = false;
    let started = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index]!;
      if (character === '"') {
        quoted = !quoted;
        started = true;
      } else if (quoted && character === '\\' && (line[index + 1] === '"' || line[index + 1] === '\\')) {
        token += line[++index]!;
      } else if (!quoted && /\s/u.test(character)) {
        if (started) tokens.push(token);
        token = '';
        started = false;
      } else {
        token += character;
        started = true;
      }
    }
    if (quoted) throw new Error('unterminated double quote');
    if (started) tokens.push(token);
    return tokens;
  }
}
