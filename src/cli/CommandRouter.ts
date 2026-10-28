import { EditorSession } from '../application/EditorSession.js';
import { AddToCommand } from '../commands/AddToCommand.js';
import { BackCommand } from '../commands/BackCommand.js';
import { CreateCommand } from '../commands/CreateCommand.js';
import { DeleteCommand } from '../commands/DeleteCommand.js';
import { FrontCommand } from '../commands/FrontCommand.js';
import { GroupCommand } from '../commands/GroupCommand.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { ScaleCommand } from '../commands/ScaleCommand.js';
import { SetCommand } from '../commands/SetCommand.js';
import { UngroupCommand } from '../commands/UngroupCommand.js';
import { CommandArguments } from './CommandArguments.js';
import { ShapeFormatter } from './ShapeFormatter.js';
import { Tokenizer } from './Tokenizer.js';

type Handler = (values: string[]) => string[] | Promise<string[]>;

export class CommandRouter {
  private readonly tokenizer = new Tokenizer();
  private readonly formatter = new ShapeFormatter();
  private readonly handlers = new Map<string, Handler>();
  private readonly syntaxes: string[] = [];
  private running = true;

  constructor(private readonly session: EditorSession) {
    // The single command-name dispatch point; registration can later become a plugin slot.
    this.register('init [w] [h]', values => {
      const args = new CommandArguments(values, 'init [w] [h]').count(0, 2);
      return [session.initialize(values.length > 0 ? args.number(0) : 800, values.length > 1 ? args.number(1) : 600)];
    });
    this.register('read <file.svg>', async values => {
      const args = new CommandArguments(values, 'read <file.svg>').count(1);
      return session.read(args.text(0));
    });
    this.register('save [file.svg]', async values => {
      new CommandArguments(values, 'save [file.svg]').count(0, 1);
      return [await session.save(values[0])];
    });
    this.register('canvas [w h]', values => {
      const args = new CommandArguments(values, 'canvas [w h]').count(0, 2);
      if (values.length === 1) throw new Error('usage: canvas [w h]');
      return [values.length ? session.canvas(args.number(0), args.number(1)) : session.canvas()];
    });
    this.register('create <type> <id> [params…] [in <containerId>]', values => this.create(values));
    this.register('delete <id>', values => {
      const args = new CommandArguments(values, 'delete <id>').count(1);
      return [session.execute(new DeleteCommand(args.text(0)))];
    });
    this.register('move <id> <dx> <dy>', values => {
      const args = new CommandArguments(values, 'move <id> <dx> <dy>').count(3);
      return [session.execute(new MoveCommand(args.text(0), args.number(1), args.number(2)))];
    });
    this.register('scale <id> <factor>', values => {
      const args = new CommandArguments(values, 'scale <id> <factor>').count(2);
      return [session.execute(new ScaleCommand(args.text(0), args.number(1)))];
    });
    this.register('set <id> <attr> <value>', values => {
      const args = new CommandArguments(values, 'set <id> <attr> <value>').count(3);
      return [session.execute(new SetCommand(args.text(0), args.text(1), args.text(2)))];
    });
    this.register('group <newGid> <id1> [id2…]', values => {
      const args = new CommandArguments(values, 'group <newGid> <id1> [id2…]').count(2, Number.MAX_SAFE_INTEGER);
      return [session.execute(new GroupCommand(args.text(0), values.slice(1)))];
    });
    this.register('ungroup <gid>', values => {
      const args = new CommandArguments(values, 'ungroup <gid>').count(1);
      return [session.execute(new UngroupCommand(args.text(0)))];
    });
    this.register('addto <gid> <id>', values => {
      const args = new CommandArguments(values, 'addto <gid> <id>').count(2);
      return [session.execute(new AddToCommand(args.text(0), args.text(1)))];
    });
    this.register('front <id>', values => {
      const args = new CommandArguments(values, 'front <id>').count(1);
      return [session.execute(new FrontCommand(args.text(0)))];
    });
    this.register('back <id>', values => {
      const args = new CommandArguments(values, 'back <id>').count(1);
      return [session.execute(new BackCommand(args.text(0)))];
    });
    this.register('tree [id]', values => {
      new CommandArguments(values, 'tree [id]').count(0, 1);
      return this.formatter.tree(session.document, values[0]);
    });
    this.register('show <id>', values => {
      const args = new CommandArguments(values, 'show <id>').count(1);
      return this.formatter.show(session.document, args.text(0));
    });
    this.register('undo', values => {
      new CommandArguments(values, 'undo').count(0);
      return [session.undo()];
    });
    this.register('redo', values => {
      new CommandArguments(values, 'redo').count(0);
      return [session.redo()];
    });
    this.register('help', values => {
      new CommandArguments(values, 'help').count(0);
      return [...this.syntaxes];
    });
    this.register('quit', values => {
      new CommandArguments(values, 'quit').count(0);
      this.running = false;
      return ['bye'];
    });
  }

  get isRunning(): boolean { return this.running; }

  async execute(line: string): Promise<string[]> {
    try {
      const [name, ...values] = this.tokenizer.tokenize(line);
      if (name === undefined) return [];
      const handler = this.handlers.get(name);
      if (!handler) throw new Error(`unknown command: ${name}`);
      return await handler(values);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [`error: ${message.replace(/[\r\n\u2028\u2029]+/gu, ' ')}`];
    }
  }

  private register(syntax: string, handler: Handler): void {
    this.handlers.set(syntax.split(' ')[0]!, handler);
    this.syntaxes.push(syntax);
  }

  private create(values: string[]): string[] {
    const args = new CommandArguments(values, 'create <type> <id> [params…] [in <containerId>]').count(2, Number.MAX_SAFE_INTEGER);
    let params = values.slice(2);
    let parentId: string | undefined;
    if (params.length >= 2 && params.at(-2) === 'in') {
      parentId = params.at(-1)!;
      params = params.slice(0, -2);
    }
    return [this.session.execute(new CreateCommand(args.text(0), args.text(1), params, parentId))];
  }
}
