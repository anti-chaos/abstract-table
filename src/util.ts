import { TableBasisId, ITableColumn, ITableColumnBundle, ITableCell, ITableRow, ITableRowBundle } from './typing';

let tableIdCounter = 0;

/**
 * 生成随机 ID
 *
 * @param suffix 随机 ID 的后缀
 */
function generateRandomId(suffix: string = ''): string {
  return `SS-TABLE-${(new Date().getTime() + ++tableIdCounter).toString(32).toUpperCase()}-${suffix.toUpperCase()}`;
}

function generateColumnId(): TableBasisId {
  return generateRandomId('column');
}

function generateRowId(): TableBasisId {
  return generateRandomId('row');
}

function initColumnBundle(columns: ITableColumn[] = [], fixed: boolean = false): ITableColumnBundle {
  return { columns, fixed };
}

function initRowBundle(rows: ITableRow[] = [], fixed: boolean = false): ITableRowBundle {
  return { rows, fixed };
}

function resolveTableBodyCellsByColumns(vms: IFieldVM[], columns: ITableColumn[]): ITableCell[] {
  const columnIndexMap = {};
  const cells: ITableCell[] = [];

  columns.forEach((col, idx) => {
    // if (col.type === 'data' && !col.trunk) {
    //   columnIndexMap[col.dataKey!] = idx;
    // } else {
    cells[idx] = { column: col };
    // }
  });

  // FIXME: 这段逻辑好像没啥实际作用。。。先注释掉
  // vms.forEach(vm => {
  //   const idx = columnIndexMap[vm.getField().name];

  //   cells[idx] = { column: columns[idx], vm };
  // });

  return cells;
}

export { generateColumnId, generateRowId, initColumnBundle, initRowBundle, resolveTableBodyCellsByColumns };
