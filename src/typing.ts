import { IEventEmitter } from '@ntks/event-emitter';

type ColSpan = number;
type RowSpan = number;

type CellId = string;

interface CellMeta {
  modified: boolean;
}

interface InternalCell {
  __meta: CellMeta;
  id: CellId;
  span?: [ColSpan, RowSpan];
  mergedCoord?: string;
}

interface TableCell extends Omit<InternalCell, '__meta'> {}

type RowId = string;

interface InternalRow {
  id: RowId;
  cells: CellId[];
}

interface TableRow extends Omit<InternalRow, 'cells'> {
  cells: TableCell[];
}

type StartColIndex = number;
type StartRowIndex = number;
type EndColIndex = number;
type EndRowIndex = number;

type TableRange = [StartColIndex, StartRowIndex, EndColIndex, EndRowIndex];

interface TableSelection {
  cell: TableCell | null;
  range: TableRange;
}

type RowFilter = (row: TableRow, index: number) => boolean;
type RowMapFn<T> = (row: TableRow, index: number) => T;

type TableEvents = 'cell-update' | 'cell-change' | 'row-update' | 'row-change';

interface Result {
  success: boolean;
  message?: string;
}

interface Table extends IEventEmitter<TableEvents> {
  getColCount(): number;
  getRowCount(): number;
  getCell(id: CellId): TableCell;
  getCell(colIndex: number, rowIndex: number): TableCell;
  setCellProperties(id: CellId, properties: Record<string, any>): void;
  isCellModified(id: CellId): boolean;
  getRow(rowIndex: number): TableRow;
  getRows(filter?: RowFilter): TableRow[];
  transformRows<T extends any = TableRow>(mapFn: RowMapFn<T>): T[];
  getRowPropertyValue(rowIndex: number, propertyName: string): any;
  setRowPropertyValue(rowIndex: number, propertyName: string, propertyValue: any): void;
  setRowsPropertyValue(
    startRowIndex: number,
    endRowIndex: number,
    propertyName: string,
    propertyValue: any,
  ): void;
  fill(cells: TableCell[]): void;
  getSelection(): TableSelection | null;
  setSelection(selection: TableSelection): void;
  clearSelection(): void;
  getMergedInRange(): string[];
  getRowsInRange(): TableRow[];
  mergeCells(): Result;
  unmergeCells(): Result;
  insertColumn(colIndex: number, count?: number): Result;
  deleteColumns(): Result;
  insertRow(rowIndex: number, count?: number): Result;
  deleteRows(): Result;
}

type CellCreator = () => Omit<TableCell, 'id'>;
type RowCreator = () => Omit<InternalRow, 'id' | 'cells'>;

interface TableInitializer {
  cellCreator: CellCreator;
  rowCreator: RowCreator;
  colCount: number;
  rowCount: number;
}

export {
  CellId,
  InternalCell,
  TableCell,
  InternalRow,
  TableRow,
  TableRange,
  TableSelection,
  RowFilter,
  RowMapFn,
  TableEvents,
  Result,
  Table,
  CellCreator,
  RowCreator,
  TableInitializer,
};
