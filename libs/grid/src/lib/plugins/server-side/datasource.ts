import type { ServerSideDataSource, GetRowsParams, GetRowsResult } from './types';

export function getBlockNumber(rowIndex: number, blockSize: number): number {
  return Math.floor(rowIndex / blockSize);
}

export function getBlockRange(blockNumber: number, blockSize: number): { start: number; end: number } {
  return {
    start: blockNumber * blockSize,
    end: (blockNumber + 1) * blockSize,
  };
}

export function getRequiredBlocks(startRow: number, endRow: number, blockSize: number): number[] {
  const startBlock = getBlockNumber(startRow, blockSize);
  const endBlock = getBlockNumber(endRow - 1, blockSize);

  const blocks: number[] = [];
  for (let i = startBlock; i <= endBlock; i++) {
    blocks.push(i);
  }
  return blocks;
}

export async function loadBlock(
  dataSource: ServerSideDataSource,
  blockNumber: number,
  blockSize: number,
  params: Partial<GetRowsParams>
): Promise<GetRowsResult> {
  const range = getBlockRange(blockNumber, blockSize);

  return dataSource.getRows({
    startRow: range.start,
    endRow: range.end,
    sortModel: params.sortModel,
    filterModel: params.filterModel,
  });
}

export function getRowFromCache(
  rowIndex: number,
  blockSize: number,
  loadedBlocks: Map<number, any[]>
): any | undefined {
  const blockNumber = getBlockNumber(rowIndex, blockSize);
  const block = loadedBlocks.get(blockNumber);
  if (!block) return undefined;

  const indexInBlock = rowIndex % blockSize;
  return block[indexInBlock];
}

export function isBlockLoaded(blockNumber: number, loadedBlocks: Map<number, any[]>): boolean {
  return loadedBlocks.has(blockNumber);
}

export function isBlockLoading(blockNumber: number, loadingBlocks: Set<number>): boolean {
  return loadingBlocks.has(blockNumber);
}
