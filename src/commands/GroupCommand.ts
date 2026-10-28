import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class GroupCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly members: readonly string[]) {
    super(); this.description = `group ${id} ${members.join(' ')}`;
  }
  execute(document: SvgDocument): string {
    const group = document.group(this.id, this.members);
    return `${group.label} created with ${group.children.length} children`;
  }
}
