import { GeometryShape } from './GeometryShape.js';

export class Ellipse extends GeometryShape {
  readonly type = 'ellipse';
  constructor(id: string, cx: number, cy: number, rx: number, ry: number, fill?: string) {
    super(id);
    this.defineGeometry('cx', cx, 'x');
    this.defineGeometry('cy', cy, 'y');
    this.defineGeometry('rx', rx, 'size', true);
    this.defineGeometry('ry', ry, 'size', true);
    if (fill !== undefined) this.setAttribute('fill', fill);
  }
  clone(): Ellipse {
    const copy = new Ellipse(this.id, 0, 0, 0, 0);
    this.copyAttributesTo(copy);
    return copy;
  }
  summary(): string {
    return this.withStyles(`cx=${this.coordinate('cx')} cy=${this.coordinate('cy')} rx=${this.coordinate('rx')} ry=${this.coordinate('ry')}`);
  }
}
