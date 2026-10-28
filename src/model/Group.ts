import { Shape } from './Shape.js';

export class Group extends Shape {
  readonly type = 'g';
  readonly #children: Shape[] = [];
  constructor(id: string, internalRoot = false) { super(id, internalRoot); }
  override get children(): readonly Shape[] { return [...this.#children]; }
  indexOf(shape: Shape): number { return this.#children.indexOf(shape); }
  isAncestorOf(shape: Shape): boolean {
    for (let parent = shape.parent; parent; parent = parent.parent) {
      if (parent === this) return true;
    }
    return false;
  }
  insert(shape: Shape, index = this.#children.length): void {
    if (shape === this || (shape instanceof Group && shape.isAncestorOf(this))) {
      throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
    }
    if (!Number.isInteger(index) || index < 0 || index > this.#children.length) {
      throw new Error('invalid child index');
    }
    const oldIndex = shape.parent === this ? this.indexOf(shape) : -1;
    shape.parent?.remove(shape);
    this.#children.splice(oldIndex >= 0 && oldIndex < index ? index - 1 : index, 0, shape);
    shape.attachTo(this);
  }
  remove(shape: Shape): number {
    const index = this.indexOf(shape);
    if (index < 0) throw new Error(`no such child: ${shape.id}`);
    this.#children.splice(index, 1);
    shape.attachTo(null);
    return index;
  }
  move(dx: number, dy: number): void {
    this.number(dx, 'dx');
    this.number(dy, 'dy');
    this.validateDescendants(child => child.move(dx, dy));
    for (const child of this.#children) child.move(dx, dy);
  }
  scale(factor: number): void {
    this.validateScale(factor);
    this.validateDescendants(child => child.scale(factor));
    for (const child of this.#children) child.scale(factor);
  }
  clone(): Group {
    const copy = new Group(this.id, this.id === '');
    this.copyAttributesTo(copy);
    for (const child of this.#children) copy.insert(child.clone());
    return copy;
  }
  summary(): string { return this.styleSummary(); }

  private validateDescendants(operation: (shape: Shape) => void): void {
    for (const child of this.#children) {
      if (child instanceof Group) child.validateDescendants(operation);
      else operation(child.clone());
    }
  }
}
