import { Shape } from './Shape.js';

/** Shared geometry validation and transformations; subclasses declare their coordinates. */
export abstract class GeometryShape extends Shape {
  readonly #geometry = new Map<string, { role: 'x' | 'y' | 'size'; nonnegative: boolean }>();

  protected constructor(id: string) { super(id); }

  protected defineGeometry(name: string, value: number, role: 'x' | 'y' | 'size', nonnegative = false): void {
    this.#geometry.set(name, { role, nonnegative });
    this.setAttribute(name, String(value));
  }

  protected coordinate(name: string): number { return Number(this.attributes.get(name)); }

  override setAttribute(name: string, value: string): void {
    const geometry = this.#geometry.get(name);
    if (geometry) this.storeAttribute(name, String(this.number(value, name, geometry.nonnegative)));
    else super.setAttribute(name, value);
  }

  move(dx: number, dy: number): void {
    this.number(dx, 'dx');
    this.number(dy, 'dy');
    const next = new Map<string, number>();
    for (const [name, { role, nonnegative }] of this.#geometry) {
      if (role !== 'size') {
        next.set(name, this.number(this.coordinate(name) + (role === 'x' ? dx : dy), name, nonnegative));
      }
    }
    for (const [name, value] of next) this.storeAttribute(name, String(value));
  }

  scale(factor: number): void {
    this.validateScale(factor);
    const next = new Map<string, number>();
    for (const [name, { nonnegative }] of this.#geometry) {
      next.set(name, this.number(this.coordinate(name) * factor, name, nonnegative));
    }
    for (const [name, value] of next) this.storeAttribute(name, String(value));
  }

  protected withStyles(geometry: string): string {
    return [geometry, this.styleSummary()].filter(Boolean).join(' ');
  }
}
