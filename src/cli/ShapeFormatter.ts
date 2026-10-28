import type { Shape } from '../model/Shape.js';
import type { SvgDocument } from '../model/SvgDocument.js';

export class ShapeFormatter {
  tree(document: SvgDocument, id?: string): string[] {
    if (id !== undefined) {
      const shape = document.requireShape(id);
      return [this.inline(shape), ...this.branches(shape.children, '')];
    }
    return [`svg (${document.width}x${document.height})`, ...this.branches(document.root.children, '')];
  }

  show(document: SvgDocument, id: string): string[] {
    const shape = document.requireShape(id);
    const parent = shape.parent?.id ? shape.parent.label : 'svg';
    const lines = [`${shape.label}  parent=${parent}`];
    const styles = new Set(['fill', 'stroke', 'stroke-width']);
    const geometry = [...shape.attributes].filter(([name]) => !styles.has(name));
    if (geometry.length) lines.push(`  ${geometry.map(([name, value]) => `${name}=${value}`).join(' ')}`);
    for (const [name, value] of shape.attributes) {
      if (styles.has(name)) lines.push(`  ${name}=${value}`);
    }
    if (shape.text !== undefined) lines.push(`  text=${JSON.stringify(shape.text)}`);
    return lines;
  }

  private inline(shape: Shape): string {
    const summary = shape.summary();
    return `${shape.label}${summary ? `  ${summary}` : ''}`;
  }

  private branches(children: readonly Shape[], prefix: string): string[] {
    const lines: string[] = [];
    children.forEach((shape, index) => {
      const last = index === children.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${this.inline(shape)}`);
      lines.push(...this.branches(shape.children, `${prefix}${last ? '    ' : '│   '}`));
    });
    return lines;
  }
}
