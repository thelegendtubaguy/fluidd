import type { ActionTree } from 'vuex'
import type { RootState } from '../types'
import type { QidiBoxState } from './types'

export const actions = {
  /**
   * Reset our store
   */
  async reset ({ commit }) {
    commit('setReset')
  },

  /**
   * Klipper and the touchscreen read the filament files when they start, so the Box card reads them again after
   * a Klipper restart or a dropped connection, such as a printer reboot
   */
  async resetFilaments ({ commit }) {
    commit('setResetFilaments')
  }
} satisfies ActionTree<QidiBoxState, RootState>
