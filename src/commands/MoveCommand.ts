import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class MoveCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly dx: number, private readonly dy: number) {
    super(); this.description = `move ${id} ${dx} ${dy}`;
  }
  execute(document: SvgDocument): string {
    document.move(this.id, this.dx, this.dy);
    return `${document.requireShape(this.id).label} moved by (${this.dx},${this.dy})`;
  }
}
