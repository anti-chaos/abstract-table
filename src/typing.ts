import { IEventEmitter } from '@ntks/event-emitter';

type ColSpan = number;
type RowSpan = number;

type CellId = string;

interface TableCell {
  id: CellId;
  span?: [ColSpan, RowSpan];
  mergedCoord?: string;
}

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

interface Table extends IEventEmitter {
  getColCount(): number;
  getRowCount(): number;
  getSelection(): TableSelection | null;
  setSelection(selection: TableSelection): void;
  clearSelection(): void;
  getCell(id: CellId): TableCell;
  getCell(colIndex: number, rowIndex: number): TableCell;
  getRows(filter: RowFilter): TableRow[];
  getRowsInRange(): TableRow[];
  transformRows<T extends any = TableRow>(mapFn: RowMapFn<T>): T[];
  getRowPropertyValue(rowIndex: number, propertyName: string): any;
  setRowPropertyValue(rowIndex: number, propertyName: string, propertyValue: any): void;
  setRowsPropertyValue(
    startRowIndex: number,
    endRowIndex: number,
    propertyName: string,
    propertyValue: any,
  ): void;
  getMergedInRange(): string[];
  mergeCells(): void;
  unmergeCells(): void;
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
  TableCell,
  InternalRow,
  TableRow,
  TableRange,
  TableSelection,
  RowFilter,
  RowMapFn,
  Table,
  CellCreator,
  RowCreator,
  TableInitializer,
};
