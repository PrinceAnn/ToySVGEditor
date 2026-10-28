import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class FrontCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string) { super(); this.description = `front ${id}`; }
  execute(document: SvgDocument): string {
    document.front(this.id);
    return `${document.requireShape(this.id).label} brought to front`;
  }
}
