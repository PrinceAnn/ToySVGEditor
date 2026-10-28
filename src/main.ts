import { EditorSession } from './application/EditorSession.js';
import { CommandRouter } from './cli/CommandRouter.js';
import { Repl } from './cli/Repl.js';
import { FileSvgRepository } from './infrastructure/FileSvgRepository.js';

const session = new EditorSession(new FileSvgRepository());
const router = new CommandRouter(session);
await new Repl(router, process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY)).run();
