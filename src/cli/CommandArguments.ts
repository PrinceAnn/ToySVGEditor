export class CommandArguments {
  constructor(private readonly values: readonly string[], private readonly syntax: string) {}

  count(minimum: number, maximum = minimum): this {
    if (this.values.length < minimum || this.values.length > maximum) throw new Error(`usage: ${this.syntax}`);
    return this;
  }

  text(index: number): string {
    const value = this.values[index];
    if (value === undefined) throw new Error(`usage: ${this.syntax}`);
    return value;
  }

  number(index: number): number {
    const value = this.text(index);
    // Number('') and hexadecimal literals are not SVG decimal coordinates.
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(value) || !Number.isFinite(Number(value))) {
      throw new Error(`invalid number: ${value}`);
    }
    return Number(value);
  }
}
