import type { SvgDocument } from '../model/SvgDocument.js';

export interface SvgReadResult {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}

export interface SvgRepository {
  read(path: string): Promise<SvgReadResult>;
  write(path: string, document: SvgDocument): Promise<void>;
}
