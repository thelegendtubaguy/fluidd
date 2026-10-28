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

  setDialogState (state, payload: QidiBoxDialogState) {
    state.dialog = payload
  },

  setFilamentList (state, payload: QidiFilamentList) {
    state.filamentList = Object.freeze(payload)
  },

  setFilamentDatabase (state, payload: QidiFilament[]) {
    state.filamentDatabase = Object.freeze(payload)
  }
} satisfies MutationTree<QidiBoxState>
