import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { FileSvgRepository } from '../src/infrastructure/FileSvgRepository.js';
import { Group } from '../src/model/Group.js';
import { Rect } from '../src/model/Rect.js';
import { ShapeFactory } from '../src/model/ShapeFactory.js';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { Text } from '../src/model/Text.js';

test('SVG round trip preserves six shape types, hierarchy, styles, and text escaping', () => {
  const document = new SvgDocument(400.5, 300);
  const factory = new ShapeFactory();
  document.append(new Group('scene'));
  document.append(factory.create('rect', 'rect', ['1', '2', '30', '40', '#eee']), 'scene');
  document.append(factory.create('circle', 'circle', ['50', '60', '20']), 'scene');
  document.append(factory.create('ellipse', 'ellipse', ['5', '6', '2', '3']), 'scene');
  document.append(factory.create('line', 'line', ['1', '2', '3', '4', 'black']), 'scene');
  document.append(new Text('text', 10, 20, '中文 😀 <tag> & "quote"\r\nnext'), 'scene');
  document.set('scene', 'fill', 'a"b&c');
  document.set('line', 'stroke-width', '2.5');
  const codec = new SvgCodec();
  const encoded = codec.encode(document);
  assert.match(encoded, /&lt;tag&gt; &amp;/);
  assert.match(encoded, /a&quot;b&amp;c/);
  const decoded = codec.decode(encoded);
  assert.deepEqual(decoded.warnings, []);
  assert.equal(decoded.document.count, 6);
  assert.equal(decoded.document.width, 400.5);
  assert.equal(codec.encode(decoded.document), encoded);
  assert.equal(decoded.document.requireShape('text').text, '中文 😀 <tag> & "quote"\r\nnext');
});

test('missing IDs reserve all explicit IDs before assigning counters per type', () => {
  const { document, warnings } = new SvgCodec().decode(`
    <svg width="400" height="300">
      <rect/><rect id="rect1"/><g><circle/><rect/></g><circle id="circle1"/>
    </svg>`);
  assert.deepEqual(warnings, [
    'warning: assigned id rect2 to unnamed <rect>',
    'warning: assigned id g1 to unnamed <g>',
    'warning: assigned id circle2 to unnamed <circle>',
    'warning: assigned id rect3 to unnamed <rect>',
  ]);
  assert.equal(document.requireShape('rect3').parent?.id, 'g1');
  assert.equal(document.requireShape('rect1').attributes.get('width'), '0');
});

test('CDATA, comments, and XML declaration are accepted and text spacing is preserved', () => {
  const { document } = new SvgCodec().decode(`<?xml version="1.0"?>
    <svg xmlns="http://www.w3.org/2000/svg"><!--comment--><text id="t">  开始 <![CDATA[<&>]]>  </text></svg>`);
  assert.equal(document.requireShape('t').text, '  开始 <&>  ');
  assert.equal(document.width, 800);
  assert.equal(document.height, 600);
});

test('canvas dimensions accept px and derive from a matching viewBox', () => {
  const codec = new SvgCodec();
  assert.equal(codec.decode('<svg width="400px" height="300px" viewBox="0,0,400,300"/>').document.width, 400);
  assert.equal(codec.decode('<svg viewBox="0 0 120 90"/>').document.height, 90);
  assert.throws(() => codec.decode('<svg width="400" height="300" viewBox="0 0 800 600"/>'), /viewBox must match/);
  assert.throws(() => codec.decode('<svg width="100%"/>'), /unsupported SVG dimension/);
  assert.throws(() => codec.decode('<svg width="0"/>'), /invalid SVG dimension/);
});

test('viewBox requires four decimal numbers and valid comma or whitespace separators', () => {
  const codec = new SvgCodec();
  assert.equal(codec.decode('<svg viewBox=" +0, -0 8e2 , 6E2 "/>').document.width, 800);
  for (const viewBox of ['0x0 0 800 600', '0,,0,800,600', '0, ,0,800,600', ',0 0 800 600', '0 0 800 600,']) {
    assert.throws(() => codec.decode(`<svg viewBox="${viewBox}"/>`), /invalid SVG viewBox/, viewBox);
  }
});

test('an unknown composite marker degrades to a normal group', () => {
  const { document } = new SvgCodec().decode('<svg><g id="box" data-kind="box"><rect id="part"/></g></svg>');
  assert.ok(document.requireShape('box') instanceof Group);
  assert.equal(document.requireShape('part').parent?.id, 'box');
});

test('duplicate IDs and unsupported types are rejected', () => {
  const codec = new SvgCodec();
  assert.throws(() => codec.decode('<svg><rect id="a"/><g><circle id="a"/></g></svg>'), /id already exists: a/);
  assert.throws(() => codec.decode('<svg><path id="p" d="M0 0"/></svg>'), /unknown shape type: path/);
});

test('unsupported SVG features are rejected rather than silently lost', () => {
  const codec = new SvgCodec();
  const unsupported = [
    '<svg><g transform="translate(1,2)"/></svg>',
    '<svg><rect style="fill:red"/></svg>',
    '<svg fill="red"/>',
    '<svg><text><tspan>nested</tspan></text></svg>',
    '<svg><rect><circle/></rect></svg>',
    '<svg><g>unexpected text</g></svg>',
    '<svg xmlns="https://example.com/other"/>',
    '<?xml-stylesheet href="style.css"?><svg/>',
  ];
  for (const xml of unsupported) assert.throws(() => codec.decode(xml), xml);
});

test('strict XML rejects malformed input, unknown entities, and DTDs', () => {
  const codec = new SvgCodec();
  const invalid = [
    '', '<html/>', '<svg><rect></svg>', '<svg/><svg/>',
    '<svg><rect id=a/></svg>', '<svg><text>&unknown;</text></svg>',
    '<!DOCTYPE svg [<!ENTITY ext SYSTEM "file:///etc/passwd">]><svg/>',
    '<svg><text>&#0;</text></svg>',
  ];
  for (const xml of invalid) assert.throws(() => codec.decode(xml), xml);
});

test('serialization rejects invalid XML characters', () => {
  const document = new SvgDocument();
  document.append(new Text('t', 0, 0, '\u0000'));
  assert.throws(() => new SvgCodec().encode(document), /invalid XML character/);
});

test('file repository saves readable SVG and translates filesystem failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'toy-svg-'));
  try {
    const repository = new FileSvgRepository();
    const document = new SvgDocument();
    document.append(new Rect('r', 1, 2, 3, 4));
    const path = join(directory, 'drawing.svg');
    await repository.write(path, document);
    assert.equal((await repository.read(path)).document.count, 1);
    assert.match(await readFile(path, 'utf8'), /id="r"/);
    assert.deepEqual(await readdir(directory), ['drawing.svg']);
    await assert.rejects(repository.read(join(directory, 'missing.svg')), /cannot read file:/);
    await assert.rejects(repository.write(join(directory, 'missing', 'drawing.svg'), document), /cannot write file:/);
    await assert.rejects(repository.write(directory, document), /cannot write file:/);
    assert.deepEqual(await readdir(directory), ['drawing.svg']);
    await writeFile(path, '<svg><rect></svg>');
    await assert.rejects(repository.read(path), /invalid SVG XML/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
