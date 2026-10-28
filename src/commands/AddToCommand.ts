import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class AddToCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly groupId: string, private readonly id: string) {
    super(); this.description = `addto ${groupId} ${id}`;
  }
  execute(document: SvgDocument): string {
    document.addTo(this.groupId, this.id);
    return `${document.requireShape(this.id).label} moved into g#${this.groupId}`;
  }
}
