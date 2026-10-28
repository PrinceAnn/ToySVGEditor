import { Circle } from './Circle.js';
import { Ellipse } from './Ellipse.js';
import { Group } from './Group.js';
import { Line } from './Line.js';
import { Rect } from './Rect.js';
import type { Shape } from './Shape.js';
import { Text } from './Text.js';

/** Phase 1 type dispatch; replace the registry with providers in the plugin phase. */
export class ShapeFactory {
  readonly #creators = new Map<string, {
    parameters: readonly string[];
    create: (id: string, params: readonly string[]) => Shape;
  }>([
    ['rect', { parameters: ['x', 'y', 'width', 'height'], create: (id, p) => { this.arity(p, 4, 5); return new Rect(id, this.number(p[0]!), this.number(p[1]!), this.number(p[2]!), this.number(p[3]!), p[4]); } }],
    ['circle', { parameters: ['cx', 'cy', 'r'], create: (id, p) => { this.arity(p, 3, 4); return new Circle(id, this.number(p[0]!), this.number(p[1]!), this.number(p[2]!), p[3]); } }],
    ['ellipse', { parameters: ['cx', 'cy', 'rx', 'ry'], create: (id, p) => { this.arity(p, 4, 5); return new Ellipse(id, this.number(p[0]!), this.number(p[1]!), this.number(p[2]!), this.number(p[3]!), p[4]); } }],
    ['line', { parameters: ['x1', 'y1', 'x2', 'y2'], create: (id, p) => { this.arity(p, 4, 5); return new Line(id, this.number(p[0]!), this.number(p[1]!), this.number(p[2]!), this.number(p[3]!), p[4]); } }],
    ['text', { parameters: ['x', 'y', 'text'], create: (id, p) => { this.arity(p, 3, 3); return new Text(id, this.number(p[0]!), this.number(p[1]!), p[2]!); } }],
    ['g', { parameters: [], create: (id, p) => { this.arity(p, 0, 0); return new Group(id); } }],
  ]);

  create(type: string, id: string, params: readonly string[]): Shape {
    const creator = this.#creators.get(type);
    if (!creator) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return creator.create(id, params);
  }

  fromAttributes(type: string, id: string, attributes: ReadonlyMap<string, string>, text?: string): Shape {
    const creator = this.#creators.get(type);
    if (!creator) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    const params = creator.parameters.map(name => name === 'text' ? text ?? '' : attributes.get(name) ?? '0');
    const shape = creator.create(id, params);
    for (const [name, value] of attributes) shape.setAttribute(name, value);
    return shape;
  }

  private arity(params: readonly string[], min: number, max: number): void {
    if (params.length < min || params.length > max) throw new Error('invalid number of shape parameters');
  }
  private number(value: string): number {
    const result = Number(value);
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(result)) {
      throw new Error(`invalid number: ${value}`);
    }
    return result;
  }
}
