import {
  ITableFieldBundle,
  TableBasisId,
  TableColumnPosition,
  TableRowPosition,
  ITableColumn,
  ITableColumnConfig,
  ITableCell,
  ITableRow,
  ITableRowConfig,
  ITableViewConfig,
  ITableLayoutInitializer,
  TableLayoutConfig,
  RowMergingConfigMap,
  ITableColumnOptions,
  ITableLayout,
} from './typing';
import {
  generateColumnId,
  generateRowId,
  initColumnBundle,
  initRowBundle,
  resolveTableBodyCellsByColumns,
} from './util';

class TableLayout implements ITableLayout {
  public readonly layout$: MemoryStream<TableLayoutConfig>;

  private layout: TableLayoutConfig;

  private dsl: IDslResolver;

  private fields: IMixedField[];
  private fieldsMap: { [key: string]: IMixedField };

  private columnsMap: { [key: string]: ITableColumn };
  // 记录表体行信息
  private rowsMap: { [key: string]: ITableRow };

  // 主干列，初始化之后不能变动
  private trunkColumns: ITableColumn[];
  // 表体主干行，初始化后只能整体替换，不可单条增减
  private trunkRows: ITableRow[];

  // 末端列，将主干列的分支列展开，最终控制显示的列
  private columns: ITableColumn[];

  // 数据列，主干列的子集
  private dataColumns: ITableColumn[];
  private dataColumnsMap: { [key: string]: ITableColumn };

  private checkboxColumn: ITableColumn;
  private sequenceColumn: ITableColumn;
  private idColumn: ITableColumn;
  private operationColumn: ITableColumn;

  private columnConfig: ITableColumnConfig;
  private rowConfig: ITableRowConfig;
  private tableConfig: ITableViewConfig;

  /**
   * 当启用单条记录操作行内显示，
   * 或启用行内编辑时显示操作列
   */
  private isOperationColumnShown(): boolean {
    return this.tableConfig.showInlineActions === true || this.tableConfig.enableInlineEditing === true;
  }

  private addTrunkDepth(
    trunk: ITableColumn | ITableRow,
    collectionMap: { [key: string]: ITableColumn | ITableRow },
  ): void {
    if (trunk.depth) {
      trunk.depth += 1;

      // 递归添加深度
      if (trunk.trunk) {
        this.addTrunkDepth(collectionMap[trunk.trunk], collectionMap);
      }
    } else {
      trunk.depth = 1;
    }
  }

  /**
   * 平级字段间用 `$$` 分割，上下级字段间用 `.` 分割
   *
   * @param col 列
   */
  private resolveDataKey(col: ITableColumn): string {
    const fieldNames: string[] = [col.fields!.map((f) => f.name).join('$$')];

    let trunk = col;

    while (trunk.trunk) {
      trunk = this.getColumnById(trunk.trunk!);

      fieldNames.unshift(trunk.fields!.map((f) => f.name).join('$$'));
    }

    return fieldNames.join('.');
  }

  private createColumns(
    fieldBundles: ITableFieldBundle[],
    position: TableColumnPosition,
    trunk?: ITableColumn,
  ): ITableColumn[] {
    const cols: ITableColumn[] = [];

    if (trunk) {
      if (!trunk.branches) {
        trunk.branches = [];
      }

      this.addTrunkDepth(trunk, this.columnsMap);
    }

    fieldBundles.forEach(({ fields, label, ...others }) => {
      const col: ITableColumn = {
        id: generateColumnId(),
        type: 'data',
        position,
        fields,
        label,
        ...others,
      };

      if (trunk) {
        col.trunk = trunk.id;
        trunk.branches!.push(col.id);
      }

      col.dataKey = this.resolveDataKey(col);

      cols.push(col);
    });

    return cols;
  }

  private resolveFieldBundles(): { left: ITableFieldBundle[]; center: ITableFieldBundle[] } {
    const prependFieldBundles: ITableFieldBundle[] = [];
    const otherFieldBundles: ITableFieldBundle[] = [];

    let idField: IMixedField = null as any;
    let idFieldNodeId: DslNodeId = '';

    this.dsl.root!.children.forEach((n) => {
      const fields: IMixedField[] = [];
      const fieldNodeIds: DslNodeId[] = [];

      let label: string = '';
      let hint: string = '';
      let width: string = '';

      const config = (n as any).config || {};

      if (config.columnWidth) {
        const matchedResult = String(config.columnWidth).match(/^(\d+(?:\.\d+)?)(%|px)?$/);

        if (matchedResult) {
          width = `${parseFloat(matchedResult[1])}${matchedResult[2] || 'px'}`;
        }
      }

      if (isSpecificElement(n, 'group')) {
        if (config.hint) {
          hint = config.hint;
        }

        label = n.props.title;

        if (n.children.length > 0) {
          n.children.forEach((_n) => {
            if (!isSpecificElement(_n, 'field')) {
              return;
            }

            const f = this.fieldsMap[_n.props.name];

            if (f) {
              if (f.name === 'id') {
                idField = f;
                idFieldNodeId = _n.id;
              } else {
                fields.push(f);
                fieldNodeIds.push(_n.id);
              }
            }
          });
        }
      } else if (isSpecificElement(n, 'field')) {
        const f = this.fieldsMap[n.props.name];

        if (!f) {
          return;
        }

        if (f.name === 'id') {
          idField = f;
          idFieldNodeId = n.id;
        } else {
          if (n.props.hint) {
            hint = n.props.hint;
          }

          label = f.displayName!;

          fields.push(f);
          fieldNodeIds.push(n.id);
        }
      }

      if (fields.length === 0) {
        return;
      }

      const bundle: ITableFieldBundle = { fields, fieldNodeIds, label, config };

      if (hint) {
        bundle.hint = hint;
      }

      if (width) {
        bundle.width = width;
      }

      otherFieldBundles.push(bundle);
    });

    if (idField) {
      prependFieldBundles.push({
        fields: [idField],
        fieldNodeIds: [idFieldNodeId],
        label: idField.displayName!,
        config: (idField as any).config || {},
      });
    }

    return { left: prependFieldBundles, center: otherFieldBundles };
  }

  private initColumnConfig(): ITableColumnConfig {
    const { left, center } = this.resolveFieldBundles();
    const columnsAtLeft: ITableColumn[] = this.createColumns(left, 'left');
    const columnsAtCenter: ITableColumn[] = this.createColumns(center, 'center');

    [...columnsAtLeft, ...columnsAtCenter].forEach((col) => {
      this.dataColumns.push(col);
      this.dataColumnsMap[col.dataKey!] = col;

      if (col.dataKey! === 'id') {
        this.idColumn = col;
      }
    });

    const { tableConfig } = this;

    if (this.idColumn) {
      this.idColumn.hidden = tableConfig.showIdColumnAlways !== true && this.idColumn.fields![0].invisible === true;
    }

    const columnsAtRight: ITableColumn[] = [];

    this.checkboxColumn = {
      id: generateColumnId(),
      position: 'left',
      type: 'checkbox',
      label: '',
      hidden: tableConfig.checkable !== true,
      config: {},
    };

    this.sequenceColumn = {
      id: generateColumnId(),
      position: 'left',
      type: 'sequence',
      label: '序号',
      hidden: tableConfig.showSequenceNumber !== true,
      config: {},
    };

    this.operationColumn = {
      id: generateColumnId(),
      position: 'right',
      type: 'operation',
      label: '操作',
      hidden: !this.isOperationColumnShown(),
      config: {},
    };

    columnsAtLeft.unshift(this.checkboxColumn, this.sequenceColumn);
    columnsAtRight.push(this.operationColumn);

    [...columnsAtLeft, ...columnsAtCenter, ...columnsAtRight].forEach((col) => {
      this.columnsMap[col.id] = col;

      this.trunkColumns.push(col);
      this.columns.push(col);
    });

    return {
      left: initColumnBundle(columnsAtLeft),
      center: initColumnBundle(columnsAtCenter),
      right: initColumnBundle(columnsAtRight, tableConfig.fixedRightColumns === true),
    };
  }

  /**
   * 将列集合中的列展开一级
   *
   * @param columns 列集合
   */
  private expandColumns(columns: ITableColumn[]): ITableColumn[] {
    const cols = [...columns];

    let idx = 0;

    columns.forEach((col) => {
      if (col.branches && col.branches.length > 0) {
        const children = col.branches.map((id) => this.getColumnById(id));

        cols.splice(idx, 1, ...children);

        idx += children.length;
      } else {
        idx++;
      }
    });

    return cols;
  }

  private resolveTableHeaderRows(): ITableRow[] {
    const rows: ITableRow[] = [];
    const rowCount = Math.max(...this.trunkColumns.map((col) => col.depth || 0)) + 1;

    let cols = this.trunkColumns;
    let currentDepth = 0;

    while (rows.length < rowCount) {
      const row: ITableRow = { id: generateRowId(), position: 'top', cells: [] };
      const nextCols: ITableColumn[] = [];

      cols.forEach((col) => {
        const depth = col.depth || 0;

        row.cells.push({
          column: col,
          rowSpan: rowCount - currentDepth - depth,
          colSpan: col.branches && col.branches.length ? col.branches.length : 1,
        });

        if (depth > currentDepth) {
          nextCols.push(col);
        }
      });

      rows.push(row);

      cols = this.expandColumns(nextCols);
      currentDepth++;
    }

    return rows;
  }

  private resolveNewTableBodyRows(rows: ITableRow[], trunkColumn?: ITableColumn): ITableRow[] {
    if (!trunkColumn) {
      return rows;
    }

    const resolvedNewRows: ITableRow[] = [];

    let trunkRow: ITableRow = this.rowsMap[rows[0].trunk!];

    // 更改主行中每个不是指定列的扩展列的单元格的跨行属性，
    // 增量比新增行的数量少一个是因为新增行的首行与主行重叠
    trunkRow.cells.forEach((cell) => {
      if (cell.column.trunk !== trunkColumn.id) {
        cell.rowSpan = (cell.rowSpan || 1) + rows.length - 1;
      }
    });

    // FIXME
    // 某一行中的某几个列以几个子行的形态显示时（例如某个一对多字段显示成表格并与主表格合并），
    // 理论上要把主行（与子行第一行重叠）中的相应几列的数据替换成子行的数据
    rows.slice(1).forEach(({ cells, ...others }) => {
      const newRow: ITableRow = {
        ...others,
        cells: cells.filter((c) => c.column.trunk === trunkColumn.id),
      };

      this.rowsMap[newRow.id] = newRow;

      resolvedNewRows.push(newRow);
    });

    return resolvedNewRows;
  }

  private initRowConfig(): ITableRowConfig {
    return {
      top: initRowBundle(this.resolveTableHeaderRows(), !this.tableConfig.embedded && this.tableConfig.fixedHeader),
      middle: initRowBundle(),
      bottom: initRowBundle(),
    };
  }

  private changeColumnVisibility(column: ITableColumn, visible: boolean): void {
    if (!column) {
      return;
    }

    column.hidden = !visible;
  }

  private changeDataColumnsVisibility(visible: boolean, dataKeys?: string): void {
    if (dataKeys) {
      dataKeys.split(',').forEach((key) => {
        this.changeColumnVisibility(this.dataColumnsMap[key], visible);
      });
    } else {
      this.dataColumns.forEach((col) => {
        // ID 列需要特殊处理
        if (col.id !== this.idColumn.id) {
          this.changeColumnVisibility(col, visible);
        }
      });
    }
  }

  private updateTableHeaderRows(): void {
    this.rowConfig.top.rows = this.resolveTableHeaderRows();
  }

  private resolveTableBodyCells(vm: IObjectVM): ITableCell[] {
    return resolveTableBodyCellsByColumns((vm as any).$$children as IFieldVM[], this.columns);
  }

  private createRows(vms: IObjectVM[], position: TableRowPosition, trunk?: ITableRow): ITableRow[] {
    const rows: ITableRow[] = [];

    if (trunk) {
      if (!trunk.branches) {
        trunk.branches = [];
      }

      this.addTrunkDepth(trunk, this.rowsMap);
    }

    vms.forEach((vm) => {
      const row: ITableRow = {
        id: generateRowId(),
        position,
        vm,
        cells: this.resolveTableBodyCells(vm),
      };

      if (trunk) {
        row.trunk = trunk.id;
        trunk.branches!.push(row.id);
      }

      this.rowsMap[row.id] = row;

      rows.push(row);
    });

    return rows;
  }

  private updateRows(rows: ITableRow[]): ITableRow[] {
    const newRows: ITableRow[] = [];

    rows.forEach(({ vm, ...others }) => {
      const row = {
        vm,
        cells: this.resolveTableBodyCells(vm!),
        ...others,
      };

      this.rowsMap[row.id] = row;

      newRows.push(row);
    });

    return newRows;
  }

  private sanitizeRows(rows: ITableRow[]): ITableRow[] {
    return rows.map(({ cells, ...others }) => {
      return { ...others, cells: cells.filter((c) => !c.column.hidden) };
    });
  }

  private resolveMergedTableBodyRows(rows: ITableRow[], mergingConfigMap: RowMergingConfigMap): ITableRow[] {
    const mergingConfigs = Object.entries(mergingConfigMap);

    if (mergingConfigs.length === 0) {
      return rows;
    }

    mergingConfigs.forEach(([fieldName, mergingConfig]) => {
      mergingConfig.forEach(({ startIndex, span }) => {
        const mergedRows = rows.slice(startIndex, startIndex + span).map(({ cells, ...others }, idx) => {
          const newCells: ITableCell[] = [];

          cells.forEach((cell) => {
            if (cell.column.type === 'data' && cell.column.dataKey === fieldName) {
              if (idx === 0) {
                newCells.push({
                  ...cell,
                  rowSpan: span,
                });
              }
            } else {
              newCells.push(cell);
            }
          });

          return {
            ...others,
            cells: newCells,
          };
        });

        rows.splice(startIndex, span, ...mergedRows);
      });
    });

    return rows;
  }

  private setLayout(layout: TableLayoutConfig): void {
    this.layout = layout;
    this.layout$._n(layout);
  }

  private resolveLayout(): void {
    const layout = {} as TableLayoutConfig;

    Object.entries(this.columnConfig).forEach(([pos, { columns, ...others }]) => {
      layout[pos] = {
        ...others,
        columns,
      };
    });

    Object.entries(this.rowConfig).forEach(([pos, { rows, ...others }]) => {
      layout[pos] = {
        ...others,
        rows: this.sanitizeRows(rows),
      };
    });

    this.setLayout(layout);
  }

  public constructor(initializer: ITableLayoutInitializer) {
    this.fields = initializer.fields;
    this.dsl = initializer.dsl;
    this.tableConfig = initializer.config || {};

    this.layout$ = xs.createWithMemory<TableLayoutConfig>();
    this.layout = {} as any;

    this.fieldsMap = this.fields.reduce((p, f) => ({ ...p, [f.name]: f }), {});
    this.columnsMap = {};
    this.rowsMap = {};
    this.trunkColumns = [];
    this.trunkRows = [];
    this.columns = [];
    this.dataColumns = [];
    this.dataColumnsMap = {};
    this.checkboxColumn = null as any;
    this.sequenceColumn = null as any;
    this.idColumn = null as any;
    this.operationColumn = null as any;
    this.columnConfig = this.initColumnConfig();
    this.rowConfig = this.initRowConfig();

    this.resolveLayout();
  }

  public setRightFixed(fixed: boolean): void {
    this.columnConfig.right.fixed = fixed === true;
  }

  public isLeftFixed(): boolean {
    return this.columnConfig.left.fixed === true;
  }

  public isRightFixed(): boolean {
    return this.columnConfig.right.fixed === true;
  }

  public isTopFixed(): boolean {
    return this.rowConfig.top.fixed === true;
  }

  public isBottomFixed(): boolean {
    return this.rowConfig.bottom.fixed === true;
  }

  public getColumnById(columnId: TableBasisId): ITableColumn {
    return this.columnsMap[columnId];
  }

  public getTrunkColumn(columnId: TableBasisId): ITableColumn {
    const column = this.getColumnById(columnId);

    return column.trunk ? this.getColumnById(column.trunk) : column;
  }

  public getRootColumn(columnId: TableBasisId): ITableColumn {
    let trunkColumn: ITableColumn = this.getColumnById(columnId);

    while (trunkColumn.trunk) {
      trunkColumn = this.getColumnById(trunkColumn.trunk);
    }

    return trunkColumn;
  }

  public getColumns(): ITableColumn[] {
    return this.columns.filter((col) => !col.hidden);
  }

  public getAllColumns(): ITableColumn[] {
    return this.columns.slice();
  }

  public getDataColumns(): ITableColumn[] {
    return this.dataColumns.slice();
  }

  public getTrunkColumns(): ITableColumn[] {
    return this.trunkColumns.filter((col) => !col.hidden);
  }

  // TODO
  public hideColumns(columns: ITableColumn[]): void {}

  // TODO
  public showColumns(columns: ITableColumn[]): void {}

  public hideColumn(columnId: TableBasisId): void {
    this.changeColumnVisibility(this.getColumnById(columnId), false);
  }

  public showColumn(columnId: TableBasisId): void {
    this.changeColumnVisibility(this.getColumnById(columnId), true);
  }

  public hideDataColumns(dataKeys: string): void {
    this.changeDataColumnsVisibility(false, dataKeys);
  }

  public showDataColumns(dataKeys: string): void {
    this.changeDataColumnsVisibility(true, dataKeys);
  }

  public hideCheckboxColumn(): void {
    this.changeColumnVisibility(this.checkboxColumn, false);
  }

  public showCheckboxColumn(): void {
    this.changeColumnVisibility(this.checkboxColumn, true);
  }

  public hideSequenceColumn(): void {
    this.changeColumnVisibility(this.sequenceColumn, false);
  }

  public showSequenceColumn(): void {
    this.changeColumnVisibility(this.sequenceColumn, true);
  }

  public hideIdColumn(): void {
    this.changeColumnVisibility(this.idColumn, false);
  }

  public showIdColumn(): void {
    this.changeColumnVisibility(this.idColumn, true);
  }

  public hideOperationColumn(): void {
    this.changeColumnVisibility(this.operationColumn, false);
  }

  public showOperationColumn(): void {
    this.changeColumnVisibility(this.operationColumn, true);
  }

  public hideAllDataColumns(): void {
    return this.changeDataColumnsVisibility(false);
  }

  public showAllDataColumns(): void {
    return this.changeDataColumnsVisibility(true);
  }

  public getTableHeaderRows(): ITableRow[] {
    return this.sanitizeRows(this.rowConfig.top.rows);
  }

  public getTableBodyRows(): ITableRow[] {
    return this.sanitizeRows(this.rowConfig.middle.rows);
  }

  public updateTableBodyRows(vms: IObjectVM[], mergingConfigMap: RowMergingConfigMap = {}): void {
    const rows = this.createRows(vms, 'middle');

    this.trunkRows = rows;
    this.rowConfig.middle.rows = this.resolveMergedTableBodyRows([...rows], mergingConfigMap);

    this.resolveLayout();
  }

  /**
   * 添加分支列
   *
   * 执行后会形成多级表头，
   * 表体的每行中相应列的数据是分支列对应字段的
   *
   * @param trunkColumn 主干列
   * @param fields 字段信息
   */
  public appendBranchColumns(trunkColumn: ITableColumn, fieldBundles: ITableFieldBundle[]): ITableColumn[] {
    const cols = this.createColumns(fieldBundles, 'center', this.getColumnById(trunkColumn.id));

    cols.forEach((col) => {
      this.columnsMap[col.id] = col;
    });

    const trunkIndex = this.columns.findIndex((col) => col.id === trunkColumn.id);

    this.columns.splice(trunkIndex, 1, ...cols);

    this.updateTableHeaderRows();

    this.rowConfig.middle.rows = this.updateRows(this.rowConfig.middle.rows);

    this.resolveLayout();

    return cols;
  }

  /**
   * 添加分支行
   *
   * 执行后会在指定行下方插入几条记录，
   * 若指定了主干列，则非主干列的单元格会跨行显示（纵跨所有分支行）
   *
   * @param trunkRow 主干行
   * @param vms 行记录（对象 VM）列表
   * @param trunkColumn 主干列
   */
  public appendBranchRows(trunkRow: ITableRow, vms: IObjectVM[], trunkColumn?: ITableColumn): ITableRow[] {
    const rows = this.resolveNewTableBodyRows(this.createRows(vms, 'middle', trunkRow), trunkColumn);
    const trunkIndex = this.rowConfig.middle.rows.findIndex((row) => row.id === trunkRow.id);

    this.rowConfig.middle.rows.splice(trunkIndex + 1, 0, ...rows);
    this.resolveLayout();

    return rows;
  }

  public insertColumn(options: TableColumnPosition | ITableColumnOptions): ITableColumn {
    const { position, ...others } = isString(options)
      ? { position: options as TableColumnPosition }
      : (options as ITableColumnOptions);

    const col: ITableColumn = {
      id: generateColumnId(),
      position,
      label: '',
      ...others,
    };

    this.columnsMap[col.id] = col;

    const lastColumn = this.columnConfig[position].columns.slice(-1).pop()!;

    const indexInTrunkColumns = this.trunkColumns.findIndex((col) => col.id === lastColumn.id) + 1;
    this.trunkColumns.splice(indexInTrunkColumns, 0, col);

    const indexInColumns = this.columns.findIndex((col) => col.id === lastColumn.id) + 1;
    this.columns.splice(indexInColumns, 0, col);

    this.updateTableHeaderRows();
    this.rowConfig.middle.rows = this.updateRows(this.rowConfig.middle.rows);

    this.resolveLayout();

    return col;
  }
}

export { TableLayout };
