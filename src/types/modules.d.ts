declare module 'xlsx/dist/xlsx.full.min.js' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }
  export interface WorkSheet {
    '!ref'?: string;
    '!merges'?: unknown[];
    [cell: string]: unknown;
  }
  export interface SheetToJSONOpts {
    header?: 1 | 'A' | unknown[];
    raw?: boolean;
    blankrows?: boolean;
    defval?: unknown;
  }
  export interface ParsingOptions {
    type?: 'base64' | 'binary' | 'string' | 'buffer' | 'array' | 'file';
    cellDates?: boolean;
    cellNF?: boolean;
    sheetStubs?: boolean;
  }
  export function read(data: unknown, opts?: ParsingOptions): WorkBook;
  export namespace utils {
    function sheet_to_json(
      sheet: WorkSheet,
      opts?: SheetToJSONOpts & { header: 1 }
    ): unknown[][];
    function sheet_to_json(
      sheet: WorkSheet,
      opts?: SheetToJSONOpts
    ): Record<string, unknown>[];
  }
}

declare module '*.xlsx';
declare module '*.txt';
