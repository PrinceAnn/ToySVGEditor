import type { SvgDocument } from '../model/SvgDocument.js';
import type { EditCommand } from './EditCommand.js';
import { HistoryEntry } from './HistoryEntry.js';

export class CommandHistory {
  private undoEntries: HistoryEntry[] = [];
  private redoEntries: HistoryEntry[] = [];
  private ioBarrier = false;

  execute(document: SvgDocument, command: EditCommand): { document: SvgDocument; message: string } {
    const working = document.clone();
    const message = command.execute(working);
    const entry = new HistoryEntry(command, document.clone(), working.clone(), message);
    // Publish history only after the command and both snapshots succeed.
    this.undoEntries.push(entry);
    this.redoEntries = [];
    this.ioBarrier = false;
    return { document: working, message };
  }

  undo(): { document: SvgDocument; message: string } {
    this.checkBarrier();
    const entry = this.undoEntries.at(-1);
    if (!entry) throw new Error('nothing to undo');
    const result = entry.undo();
    this.undoEntries.pop();
    this.redoEntries.push(entry);
    return result;
  }

  redo(): { document: SvgDocument; message: string } {
    this.checkBarrier();
    const entry = this.redoEntries.at(-1);
    if (!entry) throw new Error('nothing to redo');
    const result = entry.redo();
    this.redoEntries.pop();
    this.undoEntries.push(entry);
    return result;
  }

  blockAfterIo(): void {
    this.undoEntries = [];
    this.redoEntries = [];
    this.ioBarrier = true;
  }

  private checkBarrier(): void {
    if (this.ioBarrier) throw new Error('undo not allowed after io command');
  }
}
