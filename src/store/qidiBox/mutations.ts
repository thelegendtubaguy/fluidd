import type { MutationTree } from 'vuex'
import type { QidiBoxDialogState, QidiBoxState } from './types'
import type { QidiFilament, QidiFilamentList } from '@/util/qidi-box'
import { createState } from './state'

export const mutations = {
  /**
   * Reset state
   */
  setReset (state) {
    Object.assign(state, createState())
  },

  setResetFilaments (state) {
    const { filamentList, filamentDatabase, filamentDatabaseInvalid } = createState()

    Object.assign(state, { filamentList, filamentDatabase, filamentDatabaseInvalid })
  },

  setDialogState (state, payload: QidiBoxDialogState) {
    state.dialog = payload
  },

  setFilamentList (state, payload: QidiFilamentList) {
    state.filamentList = Object.freeze(payload)
  },

  // Null when the file was read but lists no filaments.
  setFilamentDatabase (state, payload: QidiFilament[] | null) {
    state.filamentDatabase = payload && Object.freeze(payload)
    state.filamentDatabaseInvalid = payload == null
  }
} satisfies MutationTree<QidiBoxState>
