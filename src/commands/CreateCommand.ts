import { ShapeFactory } from '../model/ShapeFactory.js';
import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class CreateCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly type: string, private readonly id: string,
    private readonly params: readonly string[], private readonly parentId?: string) {
    super();
    this.description = `create ${type} ${id}`;
  }

  execute(document: SvgDocument): string {
    const shape = new ShapeFactory().create(this.type, this.id, this.params);
    document.append(shape, this.parentId);
    return `${shape.label} created${this.parentId ? ` in g#${this.parentId}` : ''}`;
  }
}
