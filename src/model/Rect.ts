import { GeometryShape } from './GeometryShape.js';

export class Rect extends GeometryShape {
  readonly type = 'rect';
  constructor(id: string, x: number, y: number, width: number, height: number, fill?: string) {
    super(id);
    this.defineGeometry('x', x, 'x');
    this.defineGeometry('y', y, 'y');
    this.defineGeometry('width', width, 'size', true);
    this.defineGeometry('height', height, 'size', true);
    if (fill !== undefined) this.setAttribute('fill', fill);
  }
  clone(): Rect {
    const copy = new Rect(this.id, 0, 0, 0, 0);
    this.copyAttributesTo(copy);
    return copy;
  }
  summary(): string {
    return this.withStyles(`x=${this.coordinate('x')} y=${this.coordinate('y')} w=${this.coordinate('width')} h=${this.coordinate('height')}`);
  }
}
