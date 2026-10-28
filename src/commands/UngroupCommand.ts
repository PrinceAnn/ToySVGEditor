import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class UngroupCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string) { super(); this.description = `ungroup ${id}`; }
  execute(document: SvgDocument): string {
    document.ungroup(this.id);
    return `g#${this.id} ungrouped`;
  }
}
