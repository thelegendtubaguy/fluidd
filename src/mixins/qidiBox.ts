import { Component, Mixins } from 'vue-property-decorator'
import { consola } from 'consola'
import FilesMixin from './files'
import { parseQidiFilamentDatabase, parseQidiFilamentList } from '@/util/qidi-box'

@Component
export default class QidiBoxMixin extends Mixins(FilesMixin) {
  // Firmware before 01.01.07.01 resolves slot filaments only through officiall_filas_list.cfg; 01.01.07.01 lists
  // its filaments in the firmware database, which the installer links into the config root as qidi_filament_config.
  async loadQidiBoxFilaments () {
    if (this.$typedState.qidiBox.filamentList == null) {
      try {
        const response = await this.serverFilesGet<string>('config/officiall_filas_list.cfg', {
          responseType: 'text',
          transformResponse: [(value: string) => value]
        })

        this.$typedCommit('qidiBox/setFilamentList', parseQidiFilamentList(response.data))
      } catch (error) {
        consola.debug('[QidiBox] filament list unavailable', error)
      }
    }

    if (this.$typedState.qidiBox.filamentDatabase == null && this.$typedGetters['qidiBox/getHasController']) {
      try {
        const response = await this.serverFilesGet<unknown>('config/qidi_filament_config/filament-0.4.json')
        const filaments = parseQidiFilamentDatabase(response.data)

        // Invalid JSON arrives as the raw text and lists nothing.
        this.$typedCommit('qidiBox/setFilamentDatabase', filaments.length ? filaments : null)
      } catch (error) {
        consola.debug('[QidiBox] filament database unavailable', error)
      }
    }
  }
}
