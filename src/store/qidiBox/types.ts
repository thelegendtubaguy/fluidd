import type { QidiFilamentList } from '@/util/qidi-box'

export interface QidiBoxState {
  dialog: QidiBoxDialogState;
  filamentList: QidiFilamentList | null;
}

export interface QidiBoxDialogState {
  show: boolean;
  filename?: string;
}
