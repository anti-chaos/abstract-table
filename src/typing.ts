interface ITableFieldBundle {
  fields: IMixedField[];
  fieldNodeIds: DslNodeId[];
  label: string;
  hint?: string;
  width?: string;
  config?: { [key: string]: any };
}

type TableBasisId = string;

interface ITableBasis {
  id: TableBasisId;
  trunk?: TableBasisId;
  branches?: TableBasisId[];
  depth?: number;
}

type TableColumnType = 'data' | 'operation' | 'checkbox' | 'sequence';
type TableColumnPosition = 'left' | 'center' | 'right';

interface ITableColumn extends ITableBasis {
  position: TableColumnPosition;
  label: string;
  type?: TableColumnType;
  hint?: string;
  width?: string;
  hidden?: boolean;
  flag?: string;
  fields?: IMixedField[];
  fieldNodeIds?: DslNodeId[];
  dataKey?: string;
  config?: { [key: string]: any };
}

interface ITableColumnBundle {
  columns: ITableColumn[];
  fixed: boolean;
}

interface ITableColumnConfig {
  left: ITableColumnBundle; // 描述区
  center: ITableColumnBundle; // 数据区
  right: ITableColumnBundle; // 操作区
}

interface ITableCell {
  column: ITableColumn;
  vm?: IFieldVM;
  colSpan?: number;
  rowSpan?: number;
}

type TableRowPosition = 'top' | 'middle' | 'bottom';

interface ITableRow extends ITableBasis {
  position: TableRowPosition;
  vm?: IObjectVM;
  cells: ITableCell[];
}

interface ITableRowBundle {
  rows: ITableRow[];
  fixed: boolean;
}

interface ITableRowConfig {
  top: ITableRowBundle; // 表头
  middle: ITableRowBundle; // 表体
  bottom: ITableRowBundle; // 表脚
}

type TableInlineEditingInsertPosition = 'top' | 'bottom';

interface ITableViewConfig extends IListViewConfig {
  checkable?: boolean;
  showSequenceNumber?: boolean; // 显示序号
  showFilter?: boolean;
  showPagination?: boolean;
  showInlineActions?: boolean;
  showIdColumnAlways?: boolean;
  fixedHeader?: boolean;
  fixedRightColumns?: boolean;
  enableInlineEditing?: boolean;
  inlineMode?: TableInlineEditingInsertPosition;
  inlineActionsVisibleCount?: number;
  showSummary?: string; // 显示合计/汇总的字段
}

interface ITableLayoutInitializer {
  fields: IMixedField[];
  dsl: IDslResolver;
  config?: ITableViewConfig;
}

type TableLayoutConfig = ITableColumnConfig & ITableRowConfig;

type RowMergingConfig = {
  startIndex: number;
  span: number;
};

type RowMergingConfigMap = { [key: string]: RowMergingConfig[] };

interface ITableColumnOptions {
  position: TableColumnPosition;
  flag?: string;
}

interface ITableLayout {
  layout$: MemoryStream<TableLayoutConfig>;
  setRightFixed: (fixed: boolean) => void;
  isLeftFixed: () => boolean;
  isRightFixed: () => boolean;
  isTopFixed: () => boolean;
  isBottomFixed: () => boolean;
  getColumnById: (columnId: TableBasisId) => ITableColumn;
  getTrunkColumn: (columnId: TableBasisId) => ITableColumn;
  getRootColumn: (columnId: TableBasisId) => ITableColumn;
  getColumns: () => ITableColumn[];
  getAllColumns: () => ITableColumn[];
  getDataColumns: () => ITableColumn[];
  getTrunkColumns: () => ITableColumn[];
  hideColumns: (columns: ITableColumn[]) => void;
  showColumns: (columns: ITableColumn[]) => void;
  hideColumn: (columnId: TableBasisId) => void;
  showColumn: (columnId: TableBasisId) => void;
  hideDataColumns: (dataKeys: string) => void;
  showDataColumns: (dataKeys: string) => void;
  hideCheckboxColumn: () => void;
  showCheckboxColumn: () => void;
  hideSequenceColumn: () => void;
  showSequenceColumn: () => void;
  hideIdColumn: () => void;
  showIdColumn: () => void;
  hideOperationColumn: () => void;
  showOperationColumn: () => void;
  hideAllDataColumns: () => void;
  showAllDataColumns: () => void;
  getTableHeaderRows: () => ITableRow[];
  getTableBodyRows: () => ITableRow[];
  updateTableBodyRows: (vms: IObjectVM[], mergingConfigMap?: RowMergingConfigMap) => void;
  appendBranchColumns: (trunkColumn: ITableColumn, fieldBundles: ITableFieldBundle[]) => ITableColumn[];
  appendBranchRows: (trunkRow: ITableRow, vms: IObjectVM[], trunkColumn?: ITableColumn) => ITableRow[];
  insertColumn: (options: TableColumnPosition | ITableColumnOptions) => ITableColumn;
}

interface IMixedTableColumn extends ITableColumn {
  parent?: IMixedTableColumn;
  children?: IMixedTableColumn[];
}

interface IMixedTableColumnBundle extends ITableColumnBundle {
  columns: IMixedTableColumn[];
}

interface IMixedTableCell extends ITableCell {
  column: IMixedTableColumn;
}

interface IMixedTableRow extends ITableRow {
  cells: IMixedTableCell[];
}

interface IMixedTableRowBundle extends ITableRowBundle {
  rows: IMixedTableRow[];
}

interface ITableListViewRenderLayout {
  left: IMixedTableColumnBundle;
  center: IMixedTableColumnBundle;
  right: IMixedTableColumnBundle;
  top: IMixedTableRowBundle;
  middle: IMixedTableRowBundle;
  bottom: IMixedTableRowBundle;
}

interface ITableListViewRenderState {
  fields: IMixedField[];
  columns: IMixedTableColumn[];
  trunkColumns: IMixedTableColumn[];
  summary: { [key: string]: number };
  layout: ITableListViewRenderLayout;
  userPrefer: {
    standalone: boolean;
    visibleFields: string[];
    change: (...args: any[]) => void;
    save: (...args: any[]) => void;
    reset: (...args: any[]) => void;
  };
  getBehavior: (path: string) => { [key: string]: any };
}

export {
  ITableFieldBundle,
  TableBasisId,
  TableColumnType,
  TableColumnPosition,
  TableRowPosition,
  ITableColumn,
  ITableColumnBundle,
  ITableColumnConfig,
  ITableCell,
  ITableRow,
  ITableRowBundle,
  ITableRowConfig,
  ITableViewConfig,
  ITableLayoutInitializer,
  TableLayoutConfig,
  RowMergingConfig,
  RowMergingConfigMap,
  ITableColumnOptions,
  ITableLayout,
  IMixedTableColumn,
  IMixedTableCell,
  IMixedTableRow,
  ITableListViewRenderLayout,
  ITableListViewRenderState,
};
