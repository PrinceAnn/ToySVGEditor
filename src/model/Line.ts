import { GeometryShape } from './GeometryShape.js';

export class Line extends GeometryShape {
  readonly type = 'line';
  constructor(id: string, x1: number, y1: number, x2: number, y2: number, stroke?: string) {
    super(id);
    this.defineGeometry('x1', x1, 'x');
    this.defineGeometry('y1', y1, 'y');
    this.defineGeometry('x2', x2, 'x');
    this.defineGeometry('y2', y2, 'y');
    if (stroke !== undefined) this.setAttribute('stroke', stroke);
  }
  clone(): Line {
    const copy = new Line(this.id, 0, 0, 0, 0);
    this.copyAttributesTo(copy);
    return copy;
  }
  summary(): string {
    return this.withStyles(`(${this.coordinate('x1')},${this.coordinate('y1')}) -> (${this.coordinate('x2')},${this.coordinate('y2')})`);
  }
}
