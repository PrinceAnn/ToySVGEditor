import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { CommandRouter } from './CommandRouter.js';

export class Repl {
  constructor(private readonly router: CommandRouter, private readonly input: Readable,
    private readonly output: Writable, private readonly interactive: boolean) {}

  async run(): Promise<void> {
    const lines = createInterface({ input: this.input, output: this.output, terminal: this.interactive });
    this.output.write("svg-editor 0.1 — type 'help' for commands\n");
    lines.setPrompt('svg> ');
    if (this.interactive) lines.prompt();
    try {
      for await (const line of lines) {
        const result = await this.router.execute(line);
        for (const message of result) this.output.write(`${message}\n`);
        if (!this.router.isRunning) break;
        if (this.interactive) lines.prompt();
      }
    } finally {
      lines.close();
    }
  }
}
