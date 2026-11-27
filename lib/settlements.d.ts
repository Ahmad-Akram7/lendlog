import type { Record as LendRecord } from '@/types';

export function toggleSettled(
  record: LendRecord,
  options: { today: string; createId: () => string },
): LendRecord;

export function settleAllFor(
  records: LendRecord[],
  name: string,
  options: { today: string; createId: () => string },
): LendRecord[];
