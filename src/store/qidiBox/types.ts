import type { QidiFilament, QidiFilamentList } from '@/util/qidi-box'

export interface QidiBoxState {
  dialog: QidiBoxDialogState;
  filamentList: QidiFilamentList | null;
  filamentDatabase: readonly QidiFilament[] | null;
  filamentDatabaseInvalid: boolean;
}

export interface QidiBoxDialogState {
  show: boolean;
  filename?: string;
}
