import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorSession } from '../src/application/EditorSession.js';
import type { SvgReadResult, SvgRepository } from '../src/application/SvgRepository.js';
import { CommandRouter } from '../src/cli/CommandRouter.js';
import { SvgDocument } from '../src/model/SvgDocument.js';

class MemoryRepository implements SvgRepository {
  readonly files = new Map<string, SvgDocument>();
  readonly warnings = new Map<string, readonly string[]>();
  readonly unwritable = new Set<string>();
  readonly writes: string[] = [];

  async read(path: string): Promise<SvgReadResult> {
    const document = this.files.get(path);
    if (!document) throw new Error(`cannot read file: ${path}`);
    return { document: document.clone(), warnings: this.warnings.get(path) ?? [] };
  }

  async write(path: string, document: SvgDocument): Promise<void> {
    if (this.unwritable.has(path)) throw new Error(`cannot write file: ${path}`);
    this.files.set(path, document.clone());
    this.writes.push(path);
  }
}

function editor(): { session: EditorSession; router: CommandRouter; repository: MemoryRepository } {
  const repository = new MemoryRepository();
  const session = new EditorSession(repository);
  return { session, router: new CommandRouter(session), repository };
}

async function succeed(router: CommandRouter, ...commands: string[]): Promise<void> {
  for (const command of commands) {
    const output = await router.execute(command);
    assert.ok(output.length > 0, `expected feedback for ${command}`);
    assert.ok(output.every(line => !line.startsWith('error:')), `${command}: ${output.join('\n')}`);
  }
}

async function error(router: CommandRouter, command: string, message?: string): Promise<void> {
  const output = await router.execute(command);
  assert.equal(output.length, 1, command);
  assert.match(output[0]!, /^error: [^\r\n]*$/u, command);
  if (message !== undefined) assert.equal(output[0], `error: ${message}`, command);
}

test('comments and help work before initialization; document commands report the common error', async () => {
  const { router } = editor();
  assert.deepEqual(await router.execute('  # this is a script comment'), []);
  assert.deepEqual(await router.execute('   '), []);
  const help = (await router.execute('help')).join('\n');
  for (const name of ['init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set',
    'group', 'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'undo', 'redo']) {
    assert.match(help, new RegExp(`^${name}(?: |$)`, 'mu'));
  }
  for (const command of ['tree', 'show r', 'create g g1', 'save', 'canvas', 'undo', 'redo']) {
    await error(router, command, "no document. use 'init' or 'read' first");
  }
  assert.deepEqual(await router.execute('init'), ['canvas 800x600 created']);
  assert.deepEqual(await router.execute('canvas'), ['canvas 800x600']);
});

test('all six shape types support in, with optional styles omitted rather than invented', async () => {
  const { session, router } = editor();
  await succeed(router, 'init 400 300', 'create g scene', 'create g nested in scene',
    'create rect r 1 2 30 40 #aabbcc in nested', 'create circle c 5 6 7 in nested',
    'create ellipse e 8 9 10 11 red in nested', 'create line l 1 2 3 4 in nested',
    'create text t 15 25 "开始 with spaces" in nested');
  assert.equal(session.document.count, 7);
  assert.equal(session.document.requireShape('nested').parent?.id, 'scene');
  for (const id of ['r', 'c', 'e', 'l', 't']) {
    assert.equal(session.document.requireShape(id).parent?.id, 'nested');
  }
  assert.equal(session.document.requireShape('r').attributes.get('fill'), '#aabbcc');
  assert.equal(session.document.requireShape('c').attributes.has('fill'), false);
  assert.equal(session.document.requireShape('l').attributes.has('stroke'), false);
  assert.equal(session.document.requireShape('t').text, '开始 with spaces');
  assert.match((await router.execute('show t')).join('\n'), /parent=g#nested/u);
  const subtree = (await router.execute('tree nested')).join('\n');
  assert.match(subtree, /^g#nested\n/u);
  assert.match(subtree, /rect#r\s+x=1 y=2 w=30 h=40 fill=#aabbcc/u);
  assert.doesNotMatch(subtree, /g#scene/u);
});

test('quoted text preserves empty content, Unicode, quotes, backslashes, and the word in', async () => {
  const { session, router } = editor();
  await succeed(router, 'init', String.raw`create text t 1 2 "你好 \"SVG\" \\ in"`,
    'create text empty 0 0 ""', 'create text keyword 0 0 "in"');
  assert.equal(session.document.requireShape('t').text, '你好 "SVG" \\ in');
  assert.equal(session.document.requireShape('empty').text, '');
  assert.equal(session.document.requireShape('keyword').text, 'in');
  await succeed(router, 'set t text "My Diagram v2"', 'undo');
  assert.equal(session.document.requireShape('t').text, '你好 "SVG" \\ in');
  const before = await router.execute('tree');
  await error(router, 'set t text "unterminated');
  assert.deepEqual(await router.execute('tree'), before);
  await succeed(router, 'redo', 'set t text ""');
  assert.equal(session.document.requireShape('t').text, '');
});

test('container move and scale edit every descendant geometry and leave styles independent', async () => {
  const { session, router } = editor();
  await succeed(router, 'init', 'create g outer', 'create g inner in outer',
    'create rect r 1 2 3 4 in inner', 'create circle c 1 2 3 in inner',
    'create ellipse e 1 2 3 4 in inner', 'create line l 1 2 3 4 in inner',
    'create text t 1 2 "label" in inner', 'set outer fill red', 'set r fill blue',
    'set r stroke-width 2', 'move outer 10 -2', 'scale outer 2');
  const attributes = (id: string): Record<string, string> => Object.fromEntries(session.document.requireShape(id).attributes);
  assert.deepEqual(attributes('r'), { x: '22', y: '0', width: '6', height: '8', fill: 'blue', 'stroke-width': '2' });
  assert.deepEqual(attributes('c'), { cx: '22', cy: '0', r: '6' });
  assert.deepEqual(attributes('e'), { cx: '22', cy: '0', rx: '6', ry: '8' });
  assert.deepEqual(attributes('l'), { x1: '22', y1: '0', x2: '26', y2: '4' });
  assert.deepEqual(attributes('t'), { x: '22', y: '0' });
  assert.equal(session.document.requireShape('outer').attributes.get('fill'), 'red');
  await succeed(router, 'undo');
  assert.equal(session.document.requireShape('r').attributes.get('x'), '11');
  await succeed(router, 'undo');
  assert.equal(session.document.requireShape('r').attributes.get('x'), '1');
});

test('group preserves drawing order, occupies the first member slot, and undo is one unit', async () => {
  const { session, router } = editor();
  await succeed(router, 'init', 'create g parent', 'create rect a 0 0 1 1 in parent',
    'create rect b 1 1 1 1 in parent', 'create circle c 2 2 1 in parent');
  const before = await router.execute('tree');
  await succeed(router, 'group cluster c a');
  assert.deepEqual(session.document.requireShape('parent').children.map(shape => shape.id), ['cluster', 'b']);
  assert.deepEqual(session.document.requireShape('cluster').children.map(shape => shape.id), ['a', 'c']);
  await succeed(router, 'undo');
  assert.deepEqual(await router.execute('tree'), before);
  await succeed(router, 'redo', 'ungroup cluster');
  assert.deepEqual(session.document.requireShape('parent').children.map(shape => shape.id), ['a', 'c', 'b']);
  await succeed(router, 'undo');
  assert.deepEqual(session.document.requireShape('cluster').children.map(shape => shape.id), ['a', 'c']);
});

test('cross-parent grouping restores both original parent positions on undo', async () => {
  const { session, router } = editor();
  await succeed(router, 'init', 'create g left', 'create g right',
    'create rect a 0 0 1 1 in left', 'create rect b 0 0 1 1 in right',
    'create rect untouched 0 0 1 1 in left');
  const before = await router.execute('tree');
  await succeed(router, 'group joined b a');
  assert.equal(session.document.requireShape('joined').parent?.id, 'left');
  assert.deepEqual(session.document.requireShape('joined').children.map(shape => shape.id), ['a', 'b']);
  assert.equal(session.document.requireShape('right').children.length, 0);
  await succeed(router, 'undo');
  assert.deepEqual(await router.execute('tree'), before);
});

test('containment errors are atomic and keep redo, including ancestor selections in either order', async () => {
  const { router } = editor();
  await succeed(router, 'init', 'create g scene', 'create g child in scene',
    'create rect r 1 2 3 4 in child', 'move r 5 0', 'undo');
  const before = await router.execute('tree');
  for (const [command, message] of [
    ['group bad r scene', 'cannot group a container into its own descendant: scene'],
    ['group bad scene r', 'cannot group a container into its own descendant: scene'],
    ['addto child scene', 'cannot group a container into its own descendant: scene'],
    ['addto scene scene', 'cannot group a container into its own descendant: scene'],
    ['ungroup scene', 'cannot ungroup top-level container: scene'],
    ['create g lost in nowhere', 'no such container: nowhere'],
    ['create circle lost 1 2 3 in r', 'not a container: r'],
    ['create g r', 'id already exists: r'],
  ] as const) {
    await error(router, command, message);
    assert.deepEqual(await router.execute('tree'), before, command);
  }
  await succeed(router, 'redo');
  assert.match((await router.execute('tree r')).join('\n'), /x=6/u);
});

test('addto and front/back change only sibling ordering and are reversible', async () => {
  const { session, router } = editor();
  await succeed(router, 'init', 'create g scene', 'create g target',
    'create rect a 0 0 1 1 in scene', 'create rect b 0 0 1 1 in scene',
    'create rect c 0 0 1 1 in scene', 'front a');
  assert.deepEqual(session.document.requireShape('scene').children.map(shape => shape.id), ['b', 'c', 'a']);
  await succeed(router, 'back c');
  assert.deepEqual(session.document.requireShape('scene').children.map(shape => shape.id), ['c', 'b', 'a']);
  await succeed(router, 'undo');
  assert.deepEqual(session.document.requireShape('scene').children.map(shape => shape.id), ['b', 'c', 'a']);
  await succeed(router, 'addto target b');
  assert.equal(session.document.requireShape('b').parent?.id, 'target');
  await succeed(router, 'undo');
  assert.deepEqual(session.document.requireShape('scene').children.map(shape => shape.id), ['b', 'c', 'a']);
  await succeed(router, 'addto scene b');
  assert.deepEqual(session.document.requireShape('scene').children.map(shape => shape.id), ['c', 'a', 'b']);
});

test('deleting a container restores its entire subtree and id namespace in one undo', async () => {
  const { session, router } = editor();
  await succeed(router, 'init', 'create g scene', 'create g child in scene',
    'create rect r 0 0 1 1 in child', 'create text t 2 3 "hello" in child');
  const before = await router.execute('tree');
  await succeed(router, 'delete scene');
  assert.equal(session.document.count, 0);
  await error(router, 'show r', 'no such shape: r');
  await succeed(router, 'undo');
  assert.deepEqual(await router.execute('tree'), before);
  await error(router, 'create g r', 'id already exists: r');
  await succeed(router, 'redo');
  assert.equal(session.document.count, 0);
});

test('successful document commands block both histories until a new successful edit', async () => {
  for (const command of ['init', 'canvas 320 240', 'save checkpoint.svg', 'read import.svg']) {
    const { router, repository } = editor();
    repository.files.set('import.svg', new SvgDocument(123, 234));
    await succeed(router, 'init', 'create g previous', command);
    await error(router, 'undo', 'undo not allowed after io command');
    await error(router, 'redo', 'undo not allowed after io command');
    await error(router, 'create box unavailable 1 2 3 4 "later"',
      'unknown shape type: box (is the plugin loaded?)');
    await error(router, 'undo', 'undo not allowed after io command');
    await succeed(router, 'create g next', 'undo');
    await error(router, 'undo', 'nothing to undo');
    await succeed(router, 'redo', 'delete next');
  }
});

test('failed IO/resize and displays preserve document, saved path, and a pending redo', async () => {
  const { session, router, repository } = editor();
  await succeed(router, 'init', 'create rect r 1 2 3 4', 'save original.svg', 'move r 8 9', 'undo');
  repository.unwritable.add('denied.svg');
  const before = await router.execute('tree');
  for (const command of ['read missing.svg', 'save denied.svg', 'canvas -1 10', 'canvas 10', 'init 0 10']) {
    await error(router, command);
    assert.deepEqual(await router.execute('tree'), before);
    assert.equal(session.document.sourcePath, 'original.svg');
  }
  await succeed(router, 'canvas', 'show r', 'help', 'redo');
  assert.equal(session.document.requireShape('r').attributes.get('x'), '9');
  await succeed(router, 'undo', 'set r fill red');
  await error(router, 'redo', 'nothing to redo');
});

test('save remembers quoted paths and read publishes warnings only with the new document', async () => {
  const { session, router, repository } = editor();
  await succeed(router, 'init', 'create circle c 10 20 3');
  await error(router, 'save');
  await succeed(router, 'save "my diagram.svg"', 'move c 1 2', 'save');
  assert.deepEqual(repository.writes, ['my diagram.svg', 'my diagram.svg']);
  repository.files.set('other.svg', new SvgDocument(400, 300));
  repository.warnings.set('other.svg', ['warning: assigned id rect1 to unnamed <rect>']);
  assert.deepEqual(await router.execute('read other.svg'), [
    'warning: assigned id rect1 to unnamed <rect>', 'read other.svg (0 elements)',
  ]);
  assert.equal(session.document.sourcePath, 'other.svg');
  assert.equal(session.document.width, 400);
  await succeed(router, 'save');
  assert.equal(repository.writes.at(-1), 'other.svg');
});

test('invalid arguments and attribute whitelist failures leave the document unchanged', async () => {
  const { router } = editor();
  await succeed(router, 'init', 'create rect r 1 2 3 4');
  const before = await router.execute('tree');
  for (const command of ['scale r 0', 'scale r -1', 'scale r NaN', 'move r Infinity 0',
    'set r width -1', 'set r x ""', 'set r opacity 0.5', 'set r id renamed',
    'set r text nope', 'create circle bad 0 0 -1', 'create ellipse bad 0 0 1',
    'create rect bad 0 0 1 1 extra extra', 'group bad r missing', 'group bad r r',
    'delete missing', 'show', 'tree r extra', 'undo extra', 'does-not-exist']) {
    await error(router, command);
    assert.deepEqual(await router.execute('tree'), before, command);
  }
  await error(router, 'set r opacity 0.5', 'unknown attribute: opacity');
  await error(router, 'scale r 0', 'scale factor must be positive');
});

test('the supplied two-node flowchart can be replayed, edited, undone, and saved', async () => {
  const { session, router, repository } = editor();
  await succeed(router,
    'init 800 600',
    'create g flowchart',
    'create g node1 in flowchart',
    'create rect start 120 100 160 60 #4a90d9 in node1',
    'create text start-label 155 135 "开始" in node1',
    'create g node2 in flowchart',
    'create rect process 520 100 160 60 #f5a623 in node2',
    'create text process-label 545 135 "处理数据" in node2',
    'create line arrow1 280 130 520 130 black in flowchart');
  const originalTree = await router.execute('tree');
  assert.equal(session.document.count, 8);
  assert.match(originalTree.join('\n'), /└── line#arrow1\s+\(280,130\) -> \(520,130\) stroke=black/u);
  await succeed(router, 'move node2 0 100');
  assert.equal(session.document.requireShape('process').attributes.get('y'), '200');
  assert.equal(session.document.requireShape('process-label').attributes.get('y'), '235');
  assert.equal(session.document.requireShape('arrow1').attributes.get('y2'), '130');
  await succeed(router, 'undo');
  assert.deepEqual(await router.execute('tree'), originalTree);
  await succeed(router, 'set process-label text "处理数据 v2"');
  assert.deepEqual(await router.execute('save flowchart.svg'), ['saved to flowchart.svg (8 elements)']);
  const saved = repository.files.get('flowchart.svg')!;
  assert.equal(saved.requireShape('process-label').text, '处理数据 v2');
  assert.equal(saved.requireShape('node2').children.length, 2);
  await error(router, 'undo', 'undo not allowed after io command');
});
