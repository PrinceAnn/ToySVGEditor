import { GeometryShape } from './GeometryShape.js';

export class Text extends GeometryShape {
  readonly type = 'text';
  #content: string;
  constructor(id: string, x: number, y: number, content: string) {
    super(id);
    this.defineGeometry('x', x, 'x');
    this.defineGeometry('y', y, 'y');
    this.#content = content;
  }
  override get text(): string { return this.#content; }
  override setAttribute(name: string, value: string): void {
    if (name === 'text') this.#content = value;
    else super.setAttribute(name, value);
  }
  clone(): Text {
    const copy = new Text(this.id, 0, 0, this.#content);
    this.copyAttributesTo(copy);
    return copy;
  }
  summary(): string {
    return this.withStyles(`(${this.coordinate('x')},${this.coordinate('y')}) ${JSON.stringify(this.#content)}`);
  }
}
