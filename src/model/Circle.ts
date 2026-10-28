import { GeometryShape } from './GeometryShape.js';

export class Circle extends GeometryShape {
  readonly type = 'circle';
  constructor(id: string, cx: number, cy: number, r: number, fill?: string) {
    super(id);
    this.defineGeometry('cx', cx, 'x');
    this.defineGeometry('cy', cy, 'y');
    this.defineGeometry('r', r, 'size', true);
    if (fill !== undefined) this.setAttribute('fill', fill);
  }
  clone(): Circle {
    const copy = new Circle(this.id, 0, 0, 0);
    this.copyAttributesTo(copy);
    return copy;
  }
  summary(): string {
    return this.withStyles(`cx=${this.coordinate('cx')} cy=${this.coordinate('cy')} r=${this.coordinate('r')}`);
  }
}
