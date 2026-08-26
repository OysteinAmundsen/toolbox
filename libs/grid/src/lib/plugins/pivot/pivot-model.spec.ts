import { describe, expect, it } from 'vitest';
import { createValueKeys } from './pivot-model';
import type { PivotValueField } from './types';

describe('createValueKeys', () => {
  it('uses the bare field key when every field is unique', () => {
    const valueFields: PivotValueField[] = [
      { field: 'sales', aggFunc: 'sum' },
      { field: 'units', aggFunc: 'avg' },
    ];

    expect(createValueKeys(['Q1'], valueFields)).toEqual(['Q1|sales', 'Q1|units']);
  });

  it('disambiguates repeated fields by aggregator', () => {
    const valueFields: PivotValueField[] = [
      { field: 'sales', aggFunc: 'sum' },
      { field: 'sales', aggFunc: 'avg' },
      { field: 'units', aggFunc: 'sum' },
    ];

    expect(createValueKeys(['Q1'], valueFields)).toEqual(['Q1|sales|sum', 'Q1|sales|avg', 'Q1|units']);
  });

  it('suffixes the index when field and aggregator both repeat', () => {
    const valueFields: PivotValueField[] = [
      { field: 'sales', aggFunc: 'sum' },
      { field: 'sales', aggFunc: 'sum' },
      { field: 'sales', aggFunc: 'sum' },
    ];

    expect(createValueKeys(['Q1'], valueFields)).toEqual(['Q1|sales|sum', 'Q1|sales|sum|2', 'Q1|sales|sum|3']);
  });

  it('labels custom aggregators as "custom"', () => {
    const valueFields: PivotValueField[] = [
      { field: 'sales', aggFunc: (values: number[]) => values.length },
      { field: 'sales', aggFunc: (values: number[]) => values.length },
    ];

    expect(createValueKeys(['Q1'], valueFields)).toEqual(['Q1|sales|custom', 'Q1|sales|custom|2']);
  });

  it('does not collide when a field name contains the key separator', () => {
    const valueFields: PivotValueField[] = [
      { field: 'sales|sum', aggFunc: 'min' },
      { field: 'sales|sum', aggFunc: 'max' },
    ];

    expect(createValueKeys(['Q1'], valueFields)).toEqual(['Q1|sales|sum|min', 'Q1|sales|sum|max']);
  });
});
