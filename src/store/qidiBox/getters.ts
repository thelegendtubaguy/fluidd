import type { GetterTree } from 'vuex'
import type { QidiBoxState } from './types'
import type { RootState } from '../types'
import type { AppFileWithMeta } from '../files/types'
import { QIDI_BOX_EXTERNAL_SLOT, qidiBoxSlotNumber, qidiBoxSlots, type QidiBoxSlot } from '@/util/qidi-box'
import getFilePaths from '@/util/get-file-paths'

export const getters = {
  getBoxCount: (state, getters, rootState): number => {
    const boxCount = Number(rootState.printer.printer.save_variables?.variables?.box_count ?? 0)

    return Number.isFinite(boxCount) ? Math.max(0, Math.min(4, boxCount)) : 0
  },

  getEnabled: (state, getters, rootState): boolean => {
    return Number(rootState.printer.printer.save_variables?.variables?.enable_box ?? 0) === 1
  },

  // Firmware 01.01.07.01 drives the Box through multi_color_controller and stores QF filament IDs.
  getHasController: (state, getters, rootState): boolean => {
    return rootState.printer.printer.multi_color_controller != null
  },

  getSlots: (state, getters, rootState): QidiBoxSlot[] => {
    return qidiBoxSlots(rootState.printer.printer, state.filamentList)
  },

  getSlot: (state, getters) => (index: number): QidiBoxSlot | undefined => {
    return (getters.getSlots as QidiBoxSlot[]).find(slot => slot.index === index)
  },

  // value_tN maps tool N to the slot it loads.
  getToolMap: (state, getters, rootState): Record<number, number> => {
    const variables: Record<string, unknown> = rootState.printer.printer.save_variables?.variables ?? {}
    const map: Record<number, number> = {}

    for (let tool = 0; tool < 16; tool++) {
      const slot = qidiBoxSlotNumber(variables[`value_t${tool}`])

      if (slot != null) map[tool] = slot
    }

    return map
  },

  getToolheadFilament: (state, getters, rootState): boolean => {
    return rootState.printer.printer['filament_switch_sensor filament_switch_sensor']?.filament_detected === true
  },

  // The slot feeding the extruder: slot_sync, or the external spool when no Box slot is synced and the
  // toolhead sensor sees filament.
  getLoadedSlot: (state, getters, rootState): number | null => {
    const sync = rootState.printer.printer.save_variables?.variables?.slot_sync
    const slot = qidiBoxSlotNumber(sync)

    if (slot != null) return slot

    return sync === 'slot-1' && getters.getToolheadFilament ? QIDI_BOX_EXTERNAL_SLOT : null
  },

  getLastLoadSlot: (state, getters, rootState): number | null => {
    return qidiBoxSlotNumber(rootState.printer.printer.save_variables?.variables?.last_load_slot)
  },

  // Hub sensor; 0 while filament is at the hub. Firmware 01.01.07.01 publishes it only on multi_color_controller.
  getHubSensor: (state, getters, rootState): number | null => {
    const printer = rootState.printer.printer

    return printer.box_extras?.b_endstop_state ?? printer.multi_color_controller?.box?.b_endstop_state ?? null
  },

  getAutoReload: (state, getters, rootState): boolean => {
    return Number(rootState.printer.printer.save_variables?.variables?.auto_reload_detect ?? 0) === 1
  },

  getTask: (state, getters, rootState): { current_step?: string } | null => {
    const task = rootState.printer.printer.multi_color_controller?.task

    return task?.flow_id != null ? task : null
  },

  getBusy: (state, getters, rootState, rootGetters): boolean => {
    return !rootGetters['printer/getKlippyReady'] ||
      rootState.printer.printer.print_stats?.state === 'printing' ||
      !!rootState.printer.printer.box_extras?.box_button_state ||
      getters.getTask != null
  },

  // Like TLTG_RESET_TOOL_MAPPINGS, mappings change only while idle, so a paused print keeps its recovery state.
  getMappingLocked: (state, getters, rootState): boolean => {
    return getters.getBusy || rootState.printer.printer.print_stats?.state === 'paused'
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
