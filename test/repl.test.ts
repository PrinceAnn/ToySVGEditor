import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('the real CLI processes a piped script in order across asynchronous IO and recovers after errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'toy-svg-repl-'));
  const destination = join(directory, 'my diagram.svg');
  try {
    const script = [
      '# replay without a terminal', 'init 400 200', 'create g flow',
      'create rect r 10 20 100 50 #4a90d9 in flow',
      'create text t 20 40 "你好 & <SVG>" in flow',
      `save "${destination}"`, 'undo',
      `read "${destination}"`, 'move flow 5 10', 'undo', 'redo',
      'show r', 'create g r', 'tree', 'quit', 'create g should-not-run',
    ].join('\n') + '\n';
    const result = spawnSync(process.execPath, ['--import', 'tsx', resolve('src/main.ts')], {
      input: script, encoding: 'utf8', timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /saved to .*my diagram\.svg \(3 elements\)\nerror: undo not allowed after io command\nread /u);
    assert.match(result.stdout, /rect#r  parent=g#flow\n  x=15 y=30 width=100 height=50\n/u);
    assert.match(result.stdout, /error: id already exists: r\nsvg \(400x200\)/u);
    assert.match(result.stdout, /text#t\s+\(25,50\) "你好 & <SVG>"/u);
    assert.match(result.stdout, /bye\n$/u);
    assert.doesNotMatch(result.stdout, /should-not-run/u);
    const xml = await readFile(destination, 'utf8');
    assert.match(xml, /x="10" y="20"/u);
    assert.match(xml, /你好 &amp; &lt;SVG&gt;/u);
    assert.deepEqual(await readdir(directory), ['my diagram.svg']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
