import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class SetCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly attribute: string, private readonly value: string) {
    super(); this.description = `set ${id} ${attribute}`;
  }
  execute(document: SvgDocument): string {
    document.set(this.id, this.attribute, this.value);
    return `${document.requireShape(this.id).label} updated: ${this.attribute}=${JSON.stringify(this.value)}`;
  }
}
