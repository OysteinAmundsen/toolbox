export interface ResponsiveStyleMarkerState {
  cardMode: boolean;
  hideHeader: boolean;
  animate: boolean;
  transitioning: boolean;
  columnFade: boolean;
}

export function getResponsiveStyleMarkerState(host: HTMLElement): ResponsiveStyleMarkerState {
  const cardMode = host.hasAttribute('data-responsive');
  return {
    cardMode,
    hideHeader: cardMode && host.hasAttribute('data-responsive-hide-header'),
    animate: host.hasAttribute('data-responsive-animate'),
    transitioning: host.hasAttribute('data-responsive-transition'),
    columnFade: host.hasAttribute('data-responsive-column-fade'),
  };
}

export function syncResponsiveRowStyleMarkers(row: HTMLElement, state: ResponsiveStyleMarkerState): void {
  row.toggleAttribute('data-responsive-card', state.cardMode);
  row.toggleAttribute('data-responsive-card-hide-header', state.hideHeader);
  row.toggleAttribute('data-responsive-animate', state.animate);
  row.toggleAttribute('data-responsive-column-fade', state.columnFade);
}

export function syncResponsiveCellStyleMarkers(cell: HTMLElement, animate: boolean, transitioning: boolean): void {
  cell.toggleAttribute('data-responsive-animate', animate);
  cell.toggleAttribute('data-responsive-transition-cell', transitioning);
}

export function syncResponsiveStyleMarkers(row: HTMLElement, state: ResponsiveStyleMarkerState): void {
  syncResponsiveRowStyleMarkers(row, state);
  for (const cell of row.querySelectorAll<HTMLElement>(':scope > .cell')) {
    syncResponsiveCellStyleMarkers(cell, state.animate, state.transitioning);
  }
}
