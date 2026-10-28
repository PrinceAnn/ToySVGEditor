import { CommandHistory } from '../commands/CommandHistory.js';
import type { EditCommand } from '../commands/EditCommand.js';
import { SvgDocument } from '../model/SvgDocument.js';
import type { SvgRepository } from './SvgRepository.js';

export class EditorSession {
  private current: SvgDocument | undefined;
  private readonly history = new CommandHistory();

  constructor(private readonly repository: SvgRepository) {}

  get document(): SvgDocument {
    if (!this.current) throw new Error("no document. use 'init' or 'read' first");
    return this.current;
  }

  initialize(width = 800, height = 600): string {
    const document = new SvgDocument(width, height);
    this.current = document;
    this.history.blockAfterIo();
    return `canvas ${width}x${height} created`;
  }

  execute(command: EditCommand): string {
    const result = this.history.execute(this.document, command);
    this.current = result.document;
    return result.message;
  }

  undo(): string {
    void this.document;
    const result = this.history.undo();
    this.current = result.document;
    return result.message;
  }

  redo(): string {
    void this.document;
    const result = this.history.redo();
    this.current = result.document;
    return result.message;
  }

  canvas(width?: number, height?: number): string {
    if (width === undefined && height === undefined) return `canvas ${this.document.width}x${this.document.height}`;
    if (width === undefined || height === undefined) throw new Error('usage: canvas [w h]');
    const next = this.document.clone();
    next.resize(width, height);
    this.current = next;
    this.history.blockAfterIo();
    return `canvas resized to ${width}x${height}`;
  }

  async read(path: string): Promise<string[]> {
    const result = await this.repository.read(path);
    result.document.setSourcePath(path);
    this.current = result.document;
    this.history.blockAfterIo();
    return [...result.warnings, `read ${path} (${result.document.count} elements)`];
  }

  async save(path?: string): Promise<string> {
    const document = this.document;
    const destination = path ?? document.sourcePath;
    if (!destination) throw new Error('no file path. use save <file.svg>');
    await this.repository.write(destination, document);
    document.setSourcePath(destination);
    this.history.blockAfterIo();
    return `saved to ${destination} (${document.count} elements)`;
  }
}
