import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class BackCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string) { super(); this.description = `back ${id}`; }
  execute(document: SvgDocument): string {
    document.back(this.id);
    return `${document.requireShape(this.id).label} sent to back`;
  }
}
