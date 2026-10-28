import { Group } from './Group.js';
import type { Shape } from './Shape.js';

/** Owns the document tree and enforces identity, ordering, and containment invariants. */
export class SvgDocument {
  #width: number;
  #height: number;
  #sourcePath: string | undefined;
  readonly #root = new Group('', true);

  constructor(width = 800, height = 600) {
    this.validateSize(width, height);
    this.#width = width;
    this.#height = height;
  }
  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  get root(): Group { return this.#root; }
  get sourcePath(): string | undefined { return this.#sourcePath; }
  get count(): number { return this.descendants(this.#root).length; }
  setSourcePath(path: string): void { this.#sourcePath = path; }

  requireShape(id: string): Shape {
    const found = this.find(id);
    if (!found) throw new Error(`no such shape: ${id}`);
    return found;
  }
  requireContainer(id: string): Group {
    const found = this.find(id);
    if (!found) throw new Error(`no such container: ${id}`);
    if (!(found instanceof Group)) throw new Error(`not a container: ${id}`);
    return found;
  }
  append(shape: Shape, parentId?: string): void {
    const parent = parentId === undefined ? this.#root : this.requireContainer(parentId);
    const ids = new Set<string>();
    for (const candidate of [shape, ...this.descendants(shape)]) {
      this.requireNewId(candidate.id);
      if (ids.has(candidate.id)) throw new Error(`id already exists: ${candidate.id}`);
      ids.add(candidate.id);
    }
    parent.insert(shape);
  }
  delete(id: string): Shape {
    const shape = this.requireShape(id);
    shape.parent!.remove(shape);
    return shape;
  }
  move(id: string, dx: number, dy: number): void { this.requireShape(id).move(dx, dy); }
  scale(id: string, factor: number): void { this.requireShape(id).scale(factor); }
  set(id: string, attribute: string, value: string): void {
    this.requireShape(id).setAttribute(attribute, value);
  }

  group(newId: string, ids: readonly string[]): Group {
    this.requireNewId(newId);
    if (ids.length === 0) throw new Error('group requires at least one shape');
    const selected = ids.map(id => this.requireShape(id));
    if (new Set(selected).size !== selected.length) throw new Error('cannot group the same shape twice');
    for (const shape of selected) {
      if (shape instanceof Group && selected.some(other => shape.isAncestorOf(other))) {
        throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
      }
    }
    // Preserve the existing document order, independently of argument order.
    const selectedSet = new Set(selected);
    const ordered = this.descendants(this.#root).filter(shape => selectedSet.has(shape));
    const first = ordered[0]!;
    const parent = first.parent!;
    const index = parent.indexOf(first);
    const group = new Group(newId);
    for (const shape of ordered) group.insert(shape);
    parent.insert(group, index);
    return group;
  }

  ungroup(id: string): void {
    const group = this.requireContainer(id);
    const parent = group.parent!;
    if (parent === this.#root) throw new Error(`cannot ungroup top-level container: ${id}`);
    const index = parent.remove(group);
    for (const [offset, child] of group.children.entries()) parent.insert(child, index + offset);
  }
  addTo(groupId: string, id: string): void {
    const group = this.requireContainer(groupId);
    const shape = this.requireShape(id);
    group.insert(shape);
  }
  front(id: string): void {
    const shape = this.requireShape(id);
    const parent = shape.parent!;
    parent.insert(shape, parent.children.length);
  }
  back(id: string): void {
    const shape = this.requireShape(id);
    shape.parent!.insert(shape, 0);
  }
  resize(width: number, height: number): void {
    this.validateSize(width, height);
    this.#width = width;
    this.#height = height;
  }
  clone(): SvgDocument {
    const copy = new SvgDocument(this.#width, this.#height);
    copy.#sourcePath = this.#sourcePath;
    for (const child of this.#root.children) copy.#root.insert(child.clone());
    return copy;
  }

  private find(id: string): Shape | undefined {
    return this.descendants(this.#root).find(shape => shape.id === id);
  }
  private descendants(shape: Shape): Shape[] {
    return shape.children.flatMap(child => [child, ...this.descendants(child)]);
  }
  private requireNewId(id: string): void {
    if (!id || /\s/.test(id)) throw new Error('id must be nonempty and contain no whitespace');
    if (this.find(id)) throw new Error(`id already exists: ${id}`);
  }
  private validateSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('canvas dimensions must be positive finite numbers');
    }
  }
}
