import { isString, generateRandomId, includes, omit, clone } from '@ntks/toolbox';
import EventEmitter from '@ntks/event-emitter';

import {
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
} from './typing';
import { getColTitle, getColIndex, getTitleCoord } from './helper';

class AbstractTable extends EventEmitter implements Table {
  private readonly cellCreator: CellCreator;
  private readonly rowCreator: RowCreator;

  private cells: Record<CellId, TableCell> = {};
  private rows: InternalRow[] = [];

  private colCount: number = 0;
  private rowCount: number = 0;

  private selection: TableSelection | null = null;

  private merged: Record<string, TableRange> = {};

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
      ? this.rows.slice(this.selection.range[1], this.selection.range[3] + 1)
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

  public static getColTitle(index: number): string {
    return getColTitle(index);
  }

  public static getColIndex(title: string): number {
    return getColIndex(title);
  }

  public static getCoordTitle(
    colIndex: number,
    rowIndex: number,
    endColIndex?: number,
    endRowIndex?: number,
  ): string {
    return getTitleCoord(colIndex, rowIndex, endColIndex, endRowIndex);
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

  public getCell(idOrColIndex: CellId | number, rowIndex?: number): TableCell {
    return this.cells[
      isString(idOrColIndex)
        ? (idOrColIndex as CellId)
        : this.rows[rowIndex!].cells[idOrColIndex as number]
    ];
  }

  public setCellProperties(id: CellId, properties: Record<string, any>): void {
    const cell = this.cells[id];
    const props = omit(properties, ['id', 'span', 'mergedCoord']);

    Object.keys(props).forEach(key => (cell[key] = props[key]));
  }

  public getRow(rowIndex: number): TableRow {
    return clone(this.getTableRows([this.rows[rowIndex]])[0]);
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
          const [sci, sri, eci, eri] = this.selection!.range;
          const [msci, msri, meci, meri] = this.merged[coord];

          return msci >= sci && msri >= sri && meci <= eci && meri <= eri;
        })
      : [];
  }

  public mergeCells(): void {
    if (!this.selection) {
      return console.error('请先选择要合并的单元格');
    }

    const [sci, sri, eci, eri] = this.selection.range;
    const rows = this.getInternalRowsInRange();

    rows.forEach((row, ri) => {
      const colSpan = eci - sci;

      if (ri === 0) {
        const cell = this.cells[row.cells[sci]];
        const mergedCoord = getTitleCoord(sci, sri, eci, eri);

        cell.mergedCoord = mergedCoord;
        cell.span = [colSpan, eri - sri];

        this.merged[mergedCoord] = [...this.selection!.range];

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

    this.rows.splice(this.selection.range[1], rows.length, ...rows);

    this.clearSelection();
  }

  public insertColumn(colIndex: number, count: number = 1): void {
    if (colIndex < 0 || count < 1) {
      return;
    }

    this.rows.forEach(row =>
      row.cells.splice(colIndex, 0, ...(this.createCells(count) as CellId[])),
    );

    this.colCount += count;
  }

  public deleteColumns(): void {
    if (!this.selection) {
      return;
    }

    const [sci, sri, eci, eri] = this.selection.range;

    if (eri - sri + 1 !== this.rowCount) {
      return;
    }

    const count = eci - sci + 1;

    this.rows.forEach(row => this.removeCells(row.cells.splice(sci, count)));

    this.colCount -= count;
  }

  public insertRow(rowIndex: number, count: number = 1): void {
    if (rowIndex < 0 || count < 1) {
      return;
    }

    this.rows.splice(rowIndex, 0, ...this.createRows(this.colCount, count));

    this.rowCount += count;
  }

  public deleteRows(): void {
    if (!this.selection) {
      return;
    }

    const [sci, sri, eci, eri] = this.selection.range;

    if (eci - sci + 1 !== this.colCount) {
      return;
    }

    const count = eri - sri + 1;

    this.rows.splice(sri, count).forEach(row => this.removeCells(row.cells));

    this.rowCount -= count;
  }
}

export default AbstractTable;
