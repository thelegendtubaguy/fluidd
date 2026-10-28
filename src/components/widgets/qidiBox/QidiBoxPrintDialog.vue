<template>
  <app-dialog
    v-model="open"
    :title="shortFilename"
    width="560"
    :save-button-text="$t('app.general.btn.print')"
    :save-button-disabled="!canPrint"
    @save="handlePrint"
  >
    <v-card-text class="pt-4">
      <div
        v-if="thumbnailUrl"
        class="d-flex justify-center mb-4"
      >
        <img
          :src="thumbnailUrl"
          class="thumbnail"
        >
      </div>

      <div class="d-flex justify-center mb-4">
        <span v-if="file && file.estimated_time">
          <v-icon small>
            $clock
          </v-icon>
          {{ $filters.formatCounterSeconds(file.estimated_time) }}
        </span>
        <span
          v-if="file && file.filament_weight_total"
          class="ml-6"
        >
          {{ $filters.getReadableWeightString(file.filament_weight_total) }}
        </span>
      </div>

      <v-alert
        v-if="warning"
        text
        dense
        type="warning"
      >
        {{ warning }}
      </v-alert>

      <p
        v-if="useBox && tools.length > 0"
        class="text-body-2"
      >
        {{ $t('app.qidi_box.msg.choose_slots') }}
      </p>

      <v-row
        v-for="tool in tools"
        :key="tool.tool"
        dense
        align="center"
      >
        <v-col cols="6">
          <div
            class="filament"
            :style="swatchStyle(tool.color)"
          >
            T{{ tool.tool }} · {{ tool.type || '?' }}
          </div>
        </v-col>
        <v-col cols="6">
          <v-select
            v-if="useBox"
            v-model="selected[tool.tool]"
            :items="slotsForTool(tool)"
            item-value="index"
            item-text="label"
            :placeholder="'?'"
            hide-details
            outlined
            dense
          >
            <template #selection="{ item }">
              <span
                class="slot-swatch mr-2"
                :style="{ backgroundColor: item.color || 'transparent' }"
              />
              {{ item.label }}
            </template>
            <template #item="{ item }">
              <span
                class="slot-swatch mr-2"
                :style="{ backgroundColor: item.color || 'transparent' }"
              />
              {{ item.label }}
              <span class="ml-2 text--secondary">
                {{ [item.vendor, item.name].filter(Boolean).join(' ') }}
              </span>
            </template>
          </v-select>
          <span v-else>
            {{ $t('app.qidi_box.label.external_spool') }}
          </span>
        </v-col>
      </v-row>

      <v-switch
        v-model="useBox"
        :label="$t('app.qidi_box.label.use_box')"
        hide-details
        class="mt-4"
      />
    </v-card-text>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import QidiBoxMixin from '@/mixins/qidiBox'
import { SocketActions } from '@/api/socketActions'
import type { AppFileWithMeta } from '@/store/files/types'
import getFilePaths from '@/util/get-file-paths'
import {
  matchQidiBoxSlots,
  qidiBoxSlotsForTool,
  normalizeQidiColor,
  qidiTextColor,
  type QidiBoxSlot,
  type QidiBoxTool
} from '@/util/qidi-box'

@Component({})
export default class QidiBoxPrintDialog extends Mixins(StateMixin, QidiBoxMixin) {
  selected: Record<number, number | null> = {}

  get open (): boolean {
    return this.$typedState.qidiBox.dialog.show
  }

  set open (value: boolean) {
    this.$typedCommit('qidiBox/setDialogState', {
      ...this.$typedState.qidiBox.dialog,
      show: value
    })
  }

  get filename (): string | undefined {
    return this.$typedState.qidiBox.dialog.filename
  }

  get shortFilename (): string {
    return this.filename ? getFilePaths(this.filename, 'gcodes').filename : ''
  }

  get file (): AppFileWithMeta | undefined {
    if (this.filename) {
      const { rootPath, filename } = getFilePaths(this.filename, 'gcodes')

      return this.$typedGetters['files/getFile'](rootPath, filename)
    }
  }

  get thumbnailUrl (): string {
    if (this.file?.thumbnails?.length && this.filename) {
      const { path } = getFilePaths(this.filename, 'gcodes')

      return this.getThumbUrl(this.file, 'gcodes', path, true, this.file.modified)
    }

    return ''
  }

  // QIDI's Moonraker reports the tools a file uses as used_extruders and their colors as preset_colours.
  get tools (): QidiBoxTool[] {
    const file = this.file

    if (file == null) return []

    const tools = file.used_extruders ?? file.referenced_tools ?? []
    const colors = file.preset_colours ?? file.filament_colors ?? file.extruder_colors ?? []
    const types = file.filament_type ?? []

    return tools.map(tool => ({
      tool,
      type: types[tool] ?? '',
      color: colors[tool] ?? ''
    }))
  }

  get slots (): QidiBoxSlot[] {
    return this.$typedGetters['qidiBox/getSlots']
  }

  get useBox (): boolean {
    return this.$typedGetters['qidiBox/getEnabled']
  }

  set useBox (value: boolean) {
    this.sendGcode(`SAVE_VARIABLE VARIABLE=enable_box VALUE=${value ? 1 : 0}`)
  }

  get externalFilamentDetected (): boolean {
    return this.$typedState.printer.printer['filament_switch_sensor filament_switch_sensor']?.filament_detected !== false
  }

  get missingSlot (): boolean {
    return this.tools.some(tool => this.selected[tool.tool] == null)
  }

  get warning (): string {
    if (this.useBox) {
      return this.missingSlot ? this.$t('app.qidi_box.msg.missing_slot').toString() : ''
    }

    return this.externalFilamentDetected ? '' : this.$t('app.qidi_box.msg.no_external_filament').toString()
  }

  get canPrint (): boolean {
    return this.file != null && !(this.useBox && this.missingSlot)
  }

  slotsForTool (tool: QidiBoxTool): QidiBoxSlot[] {
    return qidiBoxSlotsForTool(tool, this.slots)
  }

  swatchStyle (color: string) {
    const background = normalizeQidiColor(color) ?? '#000000'

    return {
      backgroundColor: background,
      color: qidiTextColor(background)
    }
  }

  @Watch('open')
  async onOpenChanged (value: boolean) {
    if (!value) return

    this.selected = {}

    if (this.filename && this.file == null) {
      SocketActions.serverFilesMetadata(this.filename)
    }

    await this.loadQidiBoxFilaments()

    this.matchSlots()
  }

  @Watch('tools')
  onToolsChanged () {
    this.matchSlots()
  }

  matchSlots () {
    this.selected = matchQidiBoxSlots(this.tools, this.slots)
  }

  async handlePrint () {
    if (!this.filename || !this.canPrint) return

    if (this.useBox && this.tools.length > 0) {
      const script = this.tools
        .map(tool => `SAVE_VARIABLE VARIABLE=value_t${tool.tool} VALUE="'slot${this.selected[tool.tool]}'"`)
        .join('\n')

      this.addConsoleEntry(script)
      await SocketActions.printerGcodeScript(script)
    }

    SocketActions.printerPrintStart(this.filename)

    this.open = false

    if (this.$route.name !== 'home') {
      this.$router.push({ name: 'home' })
    }
  }
}
</script>

<style scoped>
.thumbnail {
  max-height: 150px;
  max-width: 150px;
}

.filament {
  border-radius: 8px;
  padding: 6px 10px;
  border: thin solid rgba(128, 128, 128, 0.5);
  font-weight: 500;
}

.slot-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: thin solid rgba(128, 128, 128, 0.7);
  vertical-align: middle;
}
</style>
