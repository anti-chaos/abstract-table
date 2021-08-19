import { generateRandomId, includes, clone } from '@ntks/toolbox';
import EventEmitter from '@ntks/event-emitter';

import {
  CellId,
  TableCell,
  InternalRow,
  TableRow,
  TableSelection,
  RowFilter,
  RowMapFn,
  Table,
  CellCreator,
  RowCreator,
  TableInitializer,
} from './typing';
import { getTitleCoord } from './helper';

class AbstractTable extends EventEmitter implements Table {
  private readonly cellCreator: CellCreator;
  private readonly rowCreator: RowCreator;

  private cells: Record<CellId, TableCell> = {};
  private rows: InternalRow[] = [];

  private colCount: number = 0;
  private rowCount: number = 0;

  private selection: TableSelection | null = null;

  private merged: Record<string, number[]> = {};

  private createCellOrPlaceholder(empty: boolean = false): CellId | undefined {
    if (empty) {
      return undefined;
    }

    const id = `${generateRandomId('AbstractTableCell')}${Object.keys(this.cells).length}`;

    this.cells[id] = { ...this.cellCreator(), id };

    return id;
  }

  private createCells(count: number, empty?: boolean): (CellId | undefined)[] {
    const cells: (CellId | undefined)[] = [];

    if (count > 0) {
      for (let ci = 0; ci < count; ci++) {
        cells.push(this.createCellOrPlaceholder(empty));
      }
    }

    return cells;
  }

  private removeCells(ids: (CellId | undefined)[]): TableCell[] {
    const cells: TableCell[] = [];

    ids.forEach(id => {
      if (id && this.cells[id]) {
        cells.push(this.cells[id]);

        delete this.cells[id];
      }
    });

    return cells;
  }

  private createRows(colCount: number, rowCount: number, placeholderCell?: boolean): InternalRow[] {
    const rows: InternalRow[] = [];

    for (let ri = 0; ri < rowCount; ri++) {
      rows.push({
        ...this.rowCreator(),
        id: `${generateRandomId('AbstractTableRow')}${ri}`,
        cells: this.createCells(colCount, placeholderCell) as CellId[],
      });
    }

    return rows;
  }

  private getTableRows(internalRows: InternalRow[] = this.rows): TableRow[] {
    return internalRows.map(({ cells, ...others }) => ({
      ...others,
      cells: cells.map(id => this.cells[id]),
    }));
  }

  private getInternalRowsInRange(): InternalRow[] {
    return this.selection
      ? this.rows.slice(this.selection.range.sri, this.selection.range.eri + 1)
      : [];
  }

  constructor({ cellCreator, rowCreator, colCount, rowCount }: TableInitializer) {
    super();

    this.cellCreator = cellCreator;
    this.rowCreator = rowCreator;

    this.colCount = colCount;
    this.rowCount = rowCount;

    this.rows = this.createRows(colCount, rowCount);
  }

  public getColCount(): number {
    return this.colCount;
  }

  public getRowCount(): number {
    return this.rowCount;
  }

  public getSelection(): TableSelection | null {
    return this.selection;
  }

  public setSelection(selection: TableSelection): void {
    this.selection = selection;
  }

  public clearSelection(): void {
    this.selection = null;
  }

  public getRows(filter?: RowFilter): TableRow[] {
    const rows = this.getTableRows();

    return clone(filter ? rows.filter(filter) : rows);
  }

  public getRowsInRange(): TableRow[] {
    return this.getTableRows(this.getInternalRowsInRange());
  }

  public transformRows<T extends any = TableRow>(mapFunc: RowMapFn<T>): T[] {
    return clone(this.getTableRows()).map(mapFunc);
  }

  public getRowPropertyValue(rowIndex: number, propertyName: string): any {
    const row = this.rows[rowIndex];

    return row ? clone(row[propertyName]) : undefined;
  }

  public setRowPropertyValue(rowIndex: number, propertyName: string, propertyValue: any): void {
    const row = this.rows[rowIndex];

    if (!row || includes(propertyName, ['id', 'cells'])) {
      return;
    }

    row[propertyName] = propertyValue;
  }

  public setRowsPropertyValue(
    startRowIndex: number,
    endRowIndex: number,
    propertyName: string,
    propertyValue: any,
  ): void {
    let ri = startRowIndex;

    while (ri <= endRowIndex) {
      this.setRowPropertyValue(ri, propertyName, propertyValue);

      ri++;
    }
  }

  public getMergedInRange(): string[] {
    return this.selection
      ? Object.keys(this.merged).filter(coord => {
          const { sci, sri, eci, eri } = this.selection!.range;
          const [msci, msri, meci, meri] = this.merged[coord];

          return msci >= sci && msri >= sri && meci <= eci && meri <= eri;
        })
      : [];
  }

  public mergeCells(): void {
    if (!this.selection) {
      return console.error('请先选择要合并的单元格');
    }

    const { sci, sri, eci, eri } = this.selection.range;
    const rows = this.getInternalRowsInRange();

    rows.forEach((row, ri) => {
      const colSpan = eci - sci;

      if (ri === 0) {
        const cell = this.cells[row.cells[sci]];
        const mergedCoord = getTitleCoord(sci, sri, eci, eri);

        cell.mergedCoord = mergedCoord;
        cell.span = [colSpan, eri - sri];

        this.merged[mergedCoord] = [sci, sri, eci, eri];

        this.removeCells(row.cells.splice(sci + 1, colSpan));
      } else {
        this.removeCells(row.cells.splice(sci, colSpan + 1));
      }
    });

    this.rows.splice(sri, rows.length, ...rows);

    this.clearSelection();
  }

  public unmergeCells(): void {
    if (!this.selection) {
      return console.error('请先选择要取消合并的单元格');
    }

    const rowsInRange = this.getInternalRowsInRange();
    const rows: InternalRow[] = this.createRows(this.colCount, rowsInRange.length, true);

    rowsInRange.forEach((row, ri) => {
      let targetCellIndex = rows[ri].cells.findIndex(cell => !cell);

      if (targetCellIndex === -1) {
        return;
      }

      row.cells.forEach(cellId => {
        const { span, mergedCoord, ...pureCell } = this.cells[cellId];

        this.cells[cellId] = pureCell;

        while (rows[ri].cells[targetCellIndex]) {
          targetCellIndex++;
        }

        rows[ri].cells[targetCellIndex] = cellId;

        if (span) {
          const [colSpan = 0, rowSpan = 0] = span;

          if (colSpan > 0) {
            this.removeCells(
              rows[ri].cells.splice(
                targetCellIndex + 1,
                colSpan,
                ...(this.createCells(colSpan) as CellId[]),
              ),
            );
          }

          if (rowSpan > 0) {
            const endRowIndex = ri + rowSpan;

            let nextRowIndex = ri + 1; // FIXME: 当选区包含已合并单元格的一部分时会报错

            while (nextRowIndex <= endRowIndex) {
              const cellCount = colSpan + 1;

              this.removeCells(
                rows[nextRowIndex].cells.splice(
                  targetCellIndex,
                  cellCount,
                  ...(this.createCells(cellCount) as CellId[]),
                ),
              );

              nextRowIndex++;
            }
          }

          if (mergedCoord) {
            delete this.merged[mergedCoord];
          }

          targetCellIndex += colSpan + 1;
        } else {
          targetCellIndex++;
        }
      });
    });

    this.rows.splice(this.selection.range.sri, rows.length, ...rows);

    this.clearSelection();
  }
}

export default AbstractTable;
