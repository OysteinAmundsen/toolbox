import type { GetRowsParams, GetRowsResult, ServerSideDataSource } from './datasource-types';

export function getBlockNumber(nodeIndex: number, blockSize: number): number {
  return Math.floor(nodeIndex / blockSize);
}

export function getBlockRange(blockNumber: number, blockSize: number): { start: number; end: number } {
  return {
    start: blockNumber * blockSize,
    end: (blockNumber + 1) * blockSize,
  };
}

export function getRequiredBlocks(startNode: number, endNode: number, blockSize: number): number[] {
  const startBlock = getBlockNumber(startNode, blockSize);
  const endBlock = getBlockNumber(endNode - 1, blockSize);

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
  params: Partial<GetRowsParams>,
): Promise<GetRowsResult> {
  const range = getBlockRange(blockNumber, blockSize);

  return dataSource.getRows({
    startNode: range.start,
    endNode: range.end,
    sortModel: params.sortModel,
    filterModel: params.filterModel,
  });
}

export function getRowFromCache(
  nodeIndex: number,
  blockSize: number,
  loadedBlocks: Map<number, unknown[]>,
): unknown | undefined {
  const blockNumber = getBlockNumber(nodeIndex, blockSize);
  const block = loadedBlocks.get(blockNumber);
  if (!block) return undefined;

  const indexInBlock = nodeIndex % blockSize;
  return block[indexInBlock];
}

export function isBlockLoaded(blockNumber: number, loadedBlocks: Map<number, unknown[]>): boolean {
  return loadedBlocks.has(blockNumber);
}

export function isBlockLoading(blockNumber: number, loadingBlocks: Set<number>): boolean {
  return loadingBlocks.has(blockNumber);
}
