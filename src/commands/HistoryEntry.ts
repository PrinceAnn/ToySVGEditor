import type { SvgDocument } from '../model/SvgDocument.js';
import type { EditCommand } from './EditCommand.js';

export class HistoryEntry {
  constructor(
    private readonly command: EditCommand,
    private readonly before: SvgDocument,
    private readonly after: SvgDocument,
    private readonly result: string,
  ) {}

  undo(): { document: SvgDocument; message: string } {
    return { document: this.before.clone(), message: `undone: ${this.command.description}` };
  }

  redo(): { document: SvgDocument; message: string } {
    return { document: this.after.clone(), message: this.result };
  }
}
