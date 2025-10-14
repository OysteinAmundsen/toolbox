export interface PivotConfig {
  enabled?: boolean;
  rowGroupFields?: string[];
  columnGroupFields?: string[];
  valueFields?: PivotValueField[];
  showTotals?: boolean;
  showGrandTotal?: boolean;
}

export interface PivotValueField {
  field: string;
  aggFunc: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';
  header?: string;
}

export interface PivotState {
  isActive: boolean;
  pivotResult: PivotResult | null;
  columnHeaders: string[];
  rowHeaders: string[];
}

export interface PivotResult {
  rows: PivotRow[];
  columnKeys: string[];
  totals: Record<string, number>;
  grandTotal: number;
}

export interface PivotRow {
  rowKey: string;
  rowLabel: string;
  depth: number;
  values: Record<string, number | null>;
  total?: number;
  isGroup: boolean;
  children?: PivotRow[];
}
