import type { GetterTree } from 'vuex'
import type { QidiBoxState } from './types'
import type { RootState } from '../types'
import type { AppFileWithMeta } from '../files/types'
import { qidiBoxSlots, type QidiBoxSlot } from '@/util/qidi-box'
import getFilePaths from '@/util/get-file-paths'

export const getters = {
  getBoxCount: (state, getters, rootState): number => {
    const boxCount = Number(rootState.printer.printer.save_variables?.variables?.box_count ?? 0)

    return Number.isFinite(boxCount) ? Math.max(0, Math.min(4, boxCount)) : 0
  },

  getEnabled: (state, getters, rootState): boolean => {
    return Number(rootState.printer.printer.save_variables?.variables?.enable_box ?? 0) === 1
  },

  getSlots: (state, getters, rootState): QidiBoxSlot[] => {
    return qidiBoxSlots(rootState.printer.printer, state.filamentList)
  },

  // Prints go through the Box slot dialog while a Box is connected. A file without loaded metadata opens it
  // too, since the dialog loads it; a file whose metadata names no tools prints as it is.
  getShowPrintDialog: (state, getters, rootState, rootGetters) => (filename: string): boolean => {
    if (getters.getBoxCount === 0) return false

    const { rootPath, filename: name } = getFilePaths(filename, 'gcodes')
    const file: AppFileWithMeta | undefined = rootGetters['files/getFile'](rootPath, name)

    if (file == null || !('slicer' in file)) return true

    return (file.used_extruders ?? file.referenced_tools ?? []).length > 0
  }
} satisfies GetterTree<QidiBoxState, RootState>
