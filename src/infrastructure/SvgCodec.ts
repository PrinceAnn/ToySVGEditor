import { DOMParser, type Element } from '@xmldom/xmldom';
import type { SvgReadResult } from '../application/SvgRepository.js';
import { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import { SvgDocument } from '../model/SvgDocument.js';

/** Strict codec for the subset the Phase 1 model can represent without data loss. */
export class SvgCodec {
  readonly #factory: ShapeFactory;
  readonly #namespace = 'http://www.w3.org/2000/svg';

  constructor(factory = new ShapeFactory()) { this.#factory = factory; }

  decode(xml: string): SvgReadResult {
    this.validateCharacters(xml);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
      throw new Error('unsupported SVG: DOCTYPE and ENTITY declarations are not allowed');
    }
    let root: Element;
    try {
      const parsed = new DOMParser({
        onError: (_level, message) => { throw new Error(message); },
      }).parseFromString(xml, 'application/xml');
      if (!parsed.documentElement) throw new Error('missing root element');
      root = parsed.documentElement;
      for (let node = parsed.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 7 && node.nodeName !== 'xml') {
          throw new Error('processing instructions are not supported');
        }
      }
    } catch {
      throw new Error('invalid SVG XML');
    }
    if (root.localName !== 'svg') throw new Error('invalid SVG: root element must be <svg>');
    this.validateNamespace(root);
    this.validateRootAttributes(root);
    const viewBox = this.readViewBox(root.getAttribute('viewBox'));
    const width = this.dimension(root.getAttribute('width'), viewBox?.[2] ?? 800);
    const height = this.dimension(root.getAttribute('height'), viewBox?.[3] ?? 600);
    if (viewBox && (viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== width || viewBox[3] !== height)) {
      throw new Error('unsupported SVG: viewBox must match the canvas dimensions');
    }
    const document = new SvgDocument(width, height);
    const reservedIds = new Set<string>();
    this.collectIds(root, reservedIds);
    const counters = new Map<string, number>();
    const warnings: string[] = [];
    this.readChildren(root, document.root, reservedIds, counters, warnings);
    return { document, warnings };
  }

  encode(document: SvgDocument): string {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="${this.#namespace}" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">`,
    ];
    for (const child of document.root.children) lines.push(this.writeShape(child, 1));
    lines.push('</svg>');
    return `${lines.join('\n')}\n`;
  }

  private collectIds(parent: Element, reserved: Set<string>): void {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1) continue;
      const element = child as Element;
      const id = element.getAttribute('id');
      if (id) {
        if (reserved.has(id)) throw new Error(`id already exists: ${id}`);
        reserved.add(id);
      }
      this.collectIds(element, reserved);
    }
  }

  private readChildren(element: Element, parent: Group, reserved: Set<string>, counters: Map<string, number>, warnings: string[]): void {
    for (let node = element.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 8) continue;
      if (node.nodeType === 3 && !(node.nodeValue ?? '').trim()) continue;
      if (node.nodeType !== 1) throw new Error(`unsupported SVG content in <${element.localName}>`);
      const child = node as Element;
      this.validateNamespace(child);
      const type = child.localName ?? child.nodeName;
      let id = child.getAttribute('id');
      if (!id) {
        let next = counters.get(type) ?? 0;
        do { id = `${type}${++next}`; } while (reserved.has(id));
        counters.set(type, next);
        reserved.add(id);
        warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
      }
      this.validateCharacters(id);
      const attributes = new Map<string, string>();
      for (let index = 0; index < child.attributes.length; index++) {
        const attribute = child.attributes.item(index)!;
        if (attribute.name === 'id' || attribute.namespaceURI === 'http://www.w3.org/2000/xmlns/') continue;
        // Unknown composite providers degrade to an ordinary group in Phase 1.
        if (attribute.name === 'data-kind' && type === 'g') continue;
        this.validateCharacters(attribute.value);
        attributes.set(attribute.name, attribute.value);
      }
      const text = this.readText(child);
      const shape = this.#factory.fromAttributes(type, id, attributes, text);
      if (shape instanceof Group) {
        this.readChildren(child, shape, reserved, counters, warnings);
      } else if (shape.text !== undefined) {
        for (let node = child.firstChild; node; node = node.nextSibling) {
          if (![3, 4, 8].includes(node.nodeType)) throw new Error('unsupported SVG content in <text>');
        }
      } else if (shape.text === undefined && child.hasChildNodes()) {
        this.validateLeafChildren(child);
      }
      parent.insert(shape);
    }
  }

  private readText(element: Element): string {
    let value = '';
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3 || child.nodeType === 4) value += child.nodeValue ?? '';
    }
    this.validateCharacters(value);
    return value;
  }

  private validateLeafChildren(element: Element): void {
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 8 || (child.nodeType === 3 && !(child.nodeValue ?? '').trim())) continue;
      throw new Error(`unsupported SVG content in <${element.localName}>`);
    }
  }

  private validateNamespace(element: Element): void {
    if (element.namespaceURI && element.namespaceURI !== this.#namespace) {
      throw new Error(`unsupported SVG namespace: ${element.namespaceURI}`);
    }
  }

  private validateRootAttributes(root: Element): void {
    for (let index = 0; index < root.attributes.length; index++) {
      const attribute = root.attributes.item(index)!;
      if (attribute.namespaceURI === 'http://www.w3.org/2000/xmlns/') continue;
      if (!['width', 'height', 'viewBox', 'version'].includes(attribute.name)) {
        throw new Error(`unsupported SVG attribute on <svg>: ${attribute.name}`);
      }
    }
  }

  private dimension(value: string | null, fallback: number): number {
    if (value === null) return fallback;
    if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:px)?$/.test(value.trim())) {
      throw new Error(`unsupported SVG dimension: ${value}`);
    }
    const result = Number(value.trim().replace(/px$/, ''));
    if (!Number.isFinite(result) || result <= 0) throw new Error(`invalid SVG dimension: ${value}`);
    return result;
  }

  private readViewBox(value: string | null): readonly [number, number, number, number] | undefined {
    if (value === null) return undefined;
    const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
    const separator = '(?:[ \\t\\r\\n]*,[ \\t\\r\\n]*|[ \\t\\r\\n]+)';
    const list = new RegExp(`^[ \\t\\r\\n]*${number}(?:${separator}${number}){3}[ \\t\\r\\n]*$`);
    if (!list.test(value)) throw new Error('invalid SVG viewBox');
    const parts = value.trim().split(/[ \t\r\n]*,[ \t\r\n]*|[ \t\r\n]+/);
    const numbers = parts.map(part => Number(part));
    if (parts.length !== 4 || numbers.some(number => !Number.isFinite(number))) {
      throw new Error('invalid SVG viewBox');
    }
    return [numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!];
  }

  private writeShape(shape: Shape, depth: number): string {
    const indentation = '  '.repeat(depth);
    const attributes = [`id="${this.escape(shape.id, true)}"`, ...[...shape.attributes]
      .map(([name, value]) => `${name}="${this.escape(value, true)}"`)].join(' ');
    if (shape.text !== undefined) {
      return `${indentation}<${shape.type} ${attributes}>${this.escape(shape.text)}</${shape.type}>`;
    }
    if (shape.children.length === 0) return `${indentation}<${shape.type} ${attributes}/>`;
    return [`${indentation}<${shape.type} ${attributes}>`,
      ...shape.children.map(child => this.writeShape(child, depth + 1)),
      `${indentation}</${shape.type}>`].join('\n');
  }

  private escape(value: string, attribute = false): string {
    this.validateCharacters(value);
    let escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');
    if (attribute) escaped = escaped.replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
    return escaped;
  }

  private validateCharacters(value: string): void {
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/u.test(value)) {
      throw new Error('invalid XML character');
    }
  }
}
