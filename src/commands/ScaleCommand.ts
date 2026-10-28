import type { SvgDocument } from '../model/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class ScaleCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly factor: number) {
    super(); this.description = `scale ${id} ${factor}`;
  }
  execute(document: SvgDocument): string {
    document.scale(this.id, this.factor);
    return `${document.requireShape(this.id).label} scaled by ${this.factor}`;
  }
}
