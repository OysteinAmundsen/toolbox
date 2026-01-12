import * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'tbw-grid': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
        class?: string;
      };
      'tbw-grid-column': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        field?: string;
        header?: string;
        type?: string;
        editable?: boolean;
        sortable?: boolean;
        resizable?: boolean;
        width?: string;
        hidden?: boolean;
        'min-width'?: number;
        'lock-visible'?: boolean;
        multi?: boolean;
        ref?: React.Ref<HTMLElement>;
      };
      'tbw-grid-header': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        title?: string;
      };
      'tbw-grid-detail': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        showExpandColumn?: string;
        animation?: string;
        ref?: React.Ref<HTMLElement>;
      };
      'tbw-grid-tool-panel': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        id?: string;
        title?: string;
        icon?: string;
        tooltip?: string;
        order?: string;
        position?: 'left' | 'right';
        ref?: React.Ref<HTMLElement>;
      };
      'tbw-grid-tool-buttons': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
      };
    }
  }
}
