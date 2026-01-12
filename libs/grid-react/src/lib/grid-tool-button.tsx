import type { ReactElement, ReactNode } from 'react';

/**
 * Props for the GridToolButtons container component.
 */
export interface GridToolButtonsProps {
  /** Child buttons to render inside the container */
  children: ReactNode;
}

/**
 * Container component for toolbar buttons in DataGrid shell header.
 *
 * This component renders a `<tbw-grid-tool-buttons>` element that gets
 * slotted into the shell toolbar. Place your buttons inside.
 *
 * ## Usage
 *
 * ```tsx
 * <DataGrid rows={rows} gridConfig={config}>
 *   <GridToolButtons>
 *     <button className="tbw-toolbar-btn" title="Export CSV" onClick={handleExport}>
 *       📄
 *     </button>
 *     <button className="tbw-toolbar-btn" title="Print" onClick={window.print}>
 *       🖨️
 *     </button>
 *   </GridToolButtons>
 * </DataGrid>
 * ```
 */
export function GridToolButtons({ children }: GridToolButtonsProps): ReactElement {
  return <tbw-grid-tool-buttons>{children}</tbw-grid-tool-buttons>;
}
