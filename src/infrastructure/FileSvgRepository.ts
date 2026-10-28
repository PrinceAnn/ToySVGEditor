import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { SvgReadResult, SvgRepository } from '../application/SvgRepository.js';
import type { SvgDocument } from '../model/SvgDocument.js';
import { SvgCodec } from './SvgCodec.js';

export class FileSvgRepository implements SvgRepository {
  readonly #codec: SvgCodec;
  constructor(codec = new SvgCodec()) { this.#codec = codec; }

  async read(path: string): Promise<SvgReadResult> {
    let xml: string;
    try { xml = await readFile(path, 'utf8'); }
    catch { throw new Error(`cannot read file: ${path}`); }
    return this.#codec.decode(xml);
  }

  async write(path: string, document: SvgDocument): Promise<void> {
    const xml = this.#codec.encode(document);
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, xml, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, path);
    } catch {
      await unlink(temporary).catch(() => undefined);
      throw new Error(`cannot write file: ${path}`);
    }
  }
}
