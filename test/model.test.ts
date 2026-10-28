import assert from 'node:assert/strict';
import test from 'node:test';
import { Circle } from '../src/model/Circle.js';
import { Group } from '../src/model/Group.js';
import { Rect } from '../src/model/Rect.js';
import { ShapeFactory } from '../src/model/ShapeFactory.js';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { Text } from '../src/model/Text.js';

test('factory supports exactly the six built-in types and preserves absent styles', () => {
  const factory = new ShapeFactory();
  const shapes = [
    factory.create('rect', 'r', ['1', '2', '3', '4']),
    factory.create('circle', 'c', ['1', '2', '3']),
    factory.create('ellipse', 'e', ['1', '2', '3', '4']),
    factory.create('line', 'l', ['1', '2', '3', '4']),
    factory.create('text', 't', ['1', '2', 'hello world']),
    factory.create('g', 'g', []),
  ];
  assert.deepEqual(shapes.map(shape => shape.type), ['rect', 'circle', 'ellipse', 'line', 'text', 'g']);
  assert.equal(shapes[0]!.attributes.has('fill'), false);
  assert.equal(shapes[3]!.attributes.has('stroke'), false);
  assert.throws(() => factory.create('box', 'b', []), /unknown shape type: box/);
  assert.throws(() => factory.create('circle', 'bad', ['0', '0', 'NaN']), /invalid number/);
  assert.throws(() => factory.create('g', 'bad', ['extra']), /invalid number of shape parameters/);
  for (const value of ['0x10', '0b10', '', ' 1', '1 ', '1px']) {
    assert.throws(() => factory.create('circle', 'bad', [value, '0', '1']), /invalid number/);
  }
  assert.equal(factory.create('circle', 'decimal', ['.5', '-2e1', '+1.2E2']).attributes.get('r'), '120');
  const imported = factory.fromAttributes('circle', 'imported', new Map([['fill', 'red']]));
  assert.deepEqual([...imported.attributes], [['cx', '0'], ['cy', '0'], ['r', '0'], ['fill', 'red']]);
});

test('recursive transformations modify all geometric coordinates and dimensions, not style widths', () => {
  const document = new SvgDocument();
  document.append(new Group('outer'));
  document.append(new Group('inner'), 'outer');
  document.append(new Rect('r', 10, 20, 30, 40, 'red'), 'inner');
  document.append(new Text('t', 4, 6, '你好'), 'outer');
  document.set('r', 'stroke-width', '2');
  document.move('outer', 3, -2);
  document.scale('outer', 2);
  assert.deepEqual([...document.requireShape('r').attributes], [
    ['x', '26'], ['y', '36'], ['width', '60'], ['height', '80'], ['fill', 'red'], ['stroke-width', '2'],
  ]);
  assert.equal(document.requireShape('t').text, '你好');
  assert.equal(document.requireShape('t').attributes.get('x'), '14');
  assert.equal(document.requireShape('t').attributes.get('y'), '8');
  const snapshot = document.clone();
  assert.throws(() => document.scale('outer', 0), /scale factor must be positive/);
  assert.deepEqual(document.requireShape('r').attributes, snapshot.requireShape('r').attributes);
});

test('geometry setters reject unsupported, negative, and nonfinite values without mutation', () => {
  const circle = new Circle('c', 1, 2, 3);
  for (const [attribute, value] of [['r', '-1'], ['cx', 'Infinity'], ['width', '1'], ['stroke-width', '-1']]) {
    const before = circle.attributes;
    assert.throws(() => circle.setAttribute(attribute!, value!));
    assert.deepEqual(circle.attributes, before);
  }
  const detachedAttributes = circle.attributes as Map<string, string>;
  detachedAttributes.set('r', '999');
  assert.equal(circle.attributes.get('r'), '3');
  assert.throws(() => circle.setAttribute('cx', '0x10'), /finite number/);
  assert.equal(circle.attributes.get('cx'), '1');
});

test('group preserves document order and first selected location across different parents', () => {
  const document = new SvgDocument();
  document.append(new Group('left'));
  document.append(new Group('right'));
  document.append(new Circle('a', 0, 0, 1), 'left');
  document.append(new Circle('b', 0, 0, 1), 'left');
  document.append(new Circle('c', 0, 0, 1), 'right');
  document.group('merged', ['c', 'a']);
  assert.deepEqual(document.requireContainer('left').children.map(shape => shape.id), ['merged', 'b']);
  assert.deepEqual(document.requireContainer('merged').children.map(shape => shape.id), ['a', 'c']);
  assert.deepEqual(document.requireContainer('right').children, []);
  document.ungroup('merged');
  assert.deepEqual(document.requireContainer('left').children.map(shape => shape.id), ['a', 'c', 'b']);
});

test('rejects grouping ancestors with descendants and rejects reparenting cycles atomically', () => {
  const document = new SvgDocument();
  document.append(new Group('outer'));
  document.append(new Group('inner'), 'outer');
  document.append(new Circle('c', 0, 0, 1), 'inner');
  assert.throws(() => document.group('bad', ['c', 'outer']), /own descendant: outer/);
  assert.throws(() => document.addTo('inner', 'outer'), /own descendant: outer/);
  assert.throws(() => document.addTo('outer', 'outer'), /own descendant: outer/);
  assert.throws(() => document.ungroup('outer'), /cannot ungroup top-level container: outer/);
  assert.equal(document.count, 3);
  assert.equal(document.requireShape('outer').parent, document.root);
  assert.equal(document.requireShape('inner').parent?.id, 'outer');
  assert.equal(document.requireShape('c').parent?.id, 'inner');
});

test('deletion removes descendants and z-order operates only within the current parent', () => {
  const document = new SvgDocument();
  document.append(new Group('g'));
  for (const id of ['a', 'b', 'c']) document.append(new Circle(id, 0, 0, 1), 'g');
  document.front('a');
  assert.deepEqual(document.requireContainer('g').children.map(shape => shape.id), ['b', 'c', 'a']);
  document.back('a');
  assert.deepEqual(document.requireContainer('g').children.map(shape => shape.id), ['a', 'b', 'c']);
  const copy = document.clone();
  document.delete('g');
  assert.equal(document.count, 0);
  assert.throws(() => document.requireShape('a'), /no such shape: a/);
  assert.equal(copy.requireShape('a').parent?.id, 'g');
  assert.equal(copy.count, 4);
});

test('enforces global ids, parent validation, canvas sizes, and deep-copy independence', () => {
  const document = new SvgDocument();
  document.append(new Circle('c', 0, 0, 1));
  document.append(new Circle('C', 0, 0, 1));
  assert.throws(() => document.append(new Group('c')), /id already exists: c/);
  assert.throws(() => document.append(new Group('new'), 'missing'), /no such container: missing/);
  assert.throws(() => document.append(new Group('new'), 'c'), /not a container: c/);
  assert.throws(() => document.resize(0, 10), /canvas dimensions/);
  assert.equal(document.width, 800);
  const copy = document.clone();
  copy.move('c', 5, 5);
  assert.equal(document.requireShape('c').attributes.get('cx'), '0');
  assert.equal(copy.requireShape('c').attributes.get('cx'), '5');
});

test('overflow in any child rejects the entire recursive transformation', () => {
  const group = new Group('g');
  group.insert(new Rect('normal', 1, 2, 3, 4));
  group.insert(new Circle('huge', Number.MAX_VALUE, 0, 1));
  assert.throws(() => group.scale(2), /finite number/);
  assert.equal(group.children[0]!.attributes.get('x'), '1');
  assert.equal(group.children[1]!.attributes.get('cx'), String(Number.MAX_VALUE));
});

test('deeply nested groups transform without recursively cloning each subtree', () => {
  const root = new Group('root');
  let container = root;
  for (let i = 0; i < 50; i++) {
    const group = new Group(`level${i}`);
    container.insert(group);
    container = group;
  }
  const leaf = new Circle('leaf', 1, 2, 3);
  container.insert(leaf);
  root.scale(2);
  root.move(1, 2);
  assert.deepEqual([...leaf.attributes], [['cx', '3'], ['cy', '6'], ['r', '6']]);
});
