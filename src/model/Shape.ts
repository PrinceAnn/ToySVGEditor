import type { Group } from './Group.js';

/** Common, encapsulated component contract for leaves and containers. */
export abstract class Shape {
  readonly #id: string;
  #parent: Group | null = null;
  readonly #attributes = new Map<string, string>();
  abstract readonly type: string;

  protected constructor(id: string, allowEmptyId = false) {
    if ((!id && !allowEmptyId) || /\s/.test(id)) {
      throw new Error('id must be nonempty and contain no whitespace');
    }
    this.#id = id;
  }

  get id(): string { return this.#id; }
  get label(): string { return `${this.type}#${this.id}`; }
  get parent(): Group | null { return this.#parent; }
  get attributes(): ReadonlyMap<string, string> { return new Map(this.#attributes); }
  get children(): readonly Shape[] { return []; }
  get text(): string | undefined { return undefined; }

  /** @internal Parent links are maintained exclusively by Group.insert/remove. */
  attachTo(parent: Group | null): void { this.#parent = parent; }

  setAttribute(name: string, value: string): void {
    if (!['fill', 'stroke', 'stroke-width'].includes(name)) {
      throw new Error(`unknown attribute: ${name}`);
    }
    this.storeAttribute(name, name === 'stroke-width'
      ? String(this.number(value, name, true)) : value);
  }

  protected storeAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }

  protected number(value: string | number, name: string, nonnegative = false): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if ((typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) || !Number.isFinite(parsed)) {
      throw new Error(`${name} must be a finite number`);
    }
    if (nonnegative && parsed < 0) throw new Error(`${name} must be nonnegative`);
    return Object.is(parsed, -0) ? 0 : parsed;
  }

  protected validateScale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error('scale factor must be positive');
    }
  }

  protected copyAttributesTo(target: Shape): void {
    for (const [name, value] of this.#attributes) target.setAttribute(name, value);
  }

  protected styleSummary(): string {
    return [...this.#attributes].filter(([name]) => ['fill', 'stroke', 'stroke-width'].includes(name))
      .map(([name, value]) => `${name}=${value}`).join(' ');
  }

  abstract move(dx: number, dy: number): void;
  abstract scale(factor: number): void;
  abstract clone(): Shape;
  abstract summary(): string;
}
