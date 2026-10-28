import type { SvgDocument } from '../model/SvgDocument.js';

export abstract class EditCommand {
  abstract readonly description: string;
  abstract execute(document: SvgDocument): string;
}
