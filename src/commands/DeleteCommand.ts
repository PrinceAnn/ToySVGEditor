import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class DeleteCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string) { super(); this.description = `delete ${id}`; }
  execute(document: SvgDocument): string {
    const label = document.requireShape(this.id).label;
    document.delete(this.id);
    return `${label} deleted`;
  }
}
