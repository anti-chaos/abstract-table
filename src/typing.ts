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

interface SelectionRange {
  sri: number; // start row index
  sci: number; // start column index
  eri: number; // end row index
  eci: number; // end column index
}

interface TableSelection {
  range: SelectionRange;
}

type CellCreator = () => Omit<TableCell, 'id'>;
type RowCreator = () => Omit<InternalRow, 'id' | 'cells'>;

interface Initializer {
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
  TableSelection,
  CellCreator,
  RowCreator,
  Initializer,
};
