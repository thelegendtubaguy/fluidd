<template>
  <collapsable-card
    :title="$t('app.qidi_box.title.qidi_box')"
    icon="$qidiBox"
    draggable
    layout-path="dashboard.box-card"
  >
    <template #menu>
      <app-btn
        small
        class="me-1 my-1"
        :disabled="mappingLocked"
        @click="mapping = true"
      >
        <v-icon
          small
          class="me-1"
        >
          $pencil
        </v-icon>
        {{ $t('app.qidi_box.title.tool_mapping') }}
      </app-btn>
      <app-btn
        small
        class="me-1 my-1"
        @click="settings = true"
      >
        <v-icon
          small
          class="me-1"
        >
          $cog
        </v-icon>
        {{ $t('app.qidi_box.btn.box_settings') }}
      </app-btn>
    </template>

    <div class="pa-3 qidi-box-card">
      <qidi-box-flow
        :slots="slots"
        :box-count="boxCount"
        :climates="climates"
        :selected="selected"
        :loaded-slot="loadedSlot"
        :hub-slot="hubSlot"
        :toolhead-slot="toolheadSlot"
        :hub-triggered="hub === 0"
        :tools-by-slot="toolsBySlot"
        :reload-groups="reloadGroups"
        :busy="busy && !flowPaused"
        :step="taskStep"
        @select="selected = $event"
        @tool-click="handleToolClick"
      />

      <v-alert
        v-if="flowPaused"
        text
        dense
        type="error"
        class="mt-3 mb-0 qidi-box-card__failure"
      >
        <div class="font-weight-medium">
          {{ failedStep }}
        </div>
        <div
          v-for="problem in problems"
          :key="`problem:${problem}`"
          class="text-body-2"
        >
          {{ problem }}
        </div>
        <div class="text-caption mt-1">
          {{ $t('app.qidi_box.msg.flow_failed_help') }}
        </div>
        <div class="mt-2 qidi-box-card__failure-actions">
          <app-btn
            small
            color="primary"
            :disabled="flowCommandDisabled"
            @click="sendFlowCommand('FLOW_RETRY')"
          >
            <v-icon
              small
              left
            >
              $refresh
            </v-icon>
            {{ $t('app.qidi_box.btn.retry') }}
          </app-btn>
          <app-btn
            small
            :disabled="flowCommandDisabled"
            @click="sendFlowCommand('FLOW_STOP')"
          >
            <v-icon
              small
              left
            >
              $stop
            </v-icon>
            {{ $t('app.qidi_box.btn.stop') }}
          </app-btn>
        </div>
      </v-alert>

      <div class="mt-3 pa-3 rounded-lg qidi-box-card__sheet">
        <div class="text-overline text--secondary qidi-box-card__overline">
          {{ overline }}
        </div>
        <div
          v-if="current.present && current.name"
          class="text-subtitle-1 font-weight-medium d-flex align-center qidi-box-card__name"
        >
          <span
            class="qidi-box-card__swatch"
            :style="{ backgroundColor: current.color || 'transparent' }"
          />
          {{ current.name }}
        </div>
        <div
          v-else
          class="text-subtitle-1 font-weight-medium text--secondary"
        >
          {{ current.present ? $t('app.qidi_box.label.unknown_filament') : $t('app.qidi_box.label.empty') }}
        </div>

        <div class="d-flex flex-wrap text-caption text--secondary mt-1 qidi-box-card__details">
          <span
            v-for="detail in details"
            :key="detail.key"
            class="d-inline-flex align-center"
            :class="{ 'amber--text': detail.key === 'rfid' }"
          >
            <v-icon
              v-if="detail.icon"
              x-small
              class="mr-1"
              :class="{ 'amber--text': detail.key === 'rfid' }"
            >
              {{ detail.icon }}
            </v-icon>
            {{ detail.text }}
          </span>
        </div>

        <div
          v-if="strandedRecovery"
          class="text-caption warning--text mt-2"
        >
          {{ strandedHint }}
        </div>

        <div class="mt-3 qidi-box-card__controls">
          <app-btn
            small
            :disabled="actionDisabled(load)"
            @click="sendAction(load)"
          >
            <v-icon
              small
              left
            >
              $loadFilament
            </v-icon>
            {{ $t('app.qidi_box.btn.load') }}
          </app-btn>
          <app-btn
            small
            :disabled="actionDisabled(unload)"
            @click="sendAction(unload)"
          >
            <v-icon
              small
              left
            >
              $unloadFilament
            </v-icon>
            {{ $t('app.qidi_box.btn.unload') }}
          </app-btn>
          <app-btn
            small
            :disabled="actionDisabled(eject)"
            @click="sendAction(eject)"
          >
            <v-icon
              small
              left
            >
              $qidiBoxEject
            </v-icon>
            {{ $t('app.qidi_box.btn.eject') }}
          </app-btn>
          <app-btn
            small
            :disabled="slotControlsDisabled"
            @click="readRfid"
          >
            <v-icon
              small
              left
            >
              $qidiBoxRfid
            </v-icon>
            {{ $t('app.qidi_box.btn.read_rfid') }}
          </app-btn>
          <template v-if="canJog">
            <app-btn
              small
              :disabled="jogDisabled"
              @click="jog(jogDistance)"
            >
              <v-icon
                small
                left
              >
                $up
              </v-icon>
              {{ $t('app.qidi_box.btn.jog_in', { distance: jogDistance }) }}
            </app-btn>
            <app-btn
              small
              :disabled="jogDisabled"
              @click="jog(-jogDistance)"
            >
              <v-icon
                small
                left
              >
                $down
              </v-icon>
              {{ $t('app.qidi_box.btn.jog_out', { distance: jogDistance }) }}
            </app-btn>
          </template>
          <app-btn
            v-if="canEditFilament"
            small
            :disabled="busy || !current.present"
            @click="editing = true"
          >
            <v-icon
              small
              left
            >
              $pencil
            </v-icon>
            {{ $t('app.qidi_box.btn.edit') }}
          </app-btn>
          <div
            v-else-if="filamentDatabaseInvalid"
            class="text-caption error--text qidi-box-card__wide"
          >
            {{ $t('app.qidi_box.msg.filament_database_invalid') }}
          </div>
        </div>
      </div>
    </div>

    <qidi-box-filament-dialog
      v-if="editing"
      v-model="editing"
      :box-slot="current"
      :busy="busy"
    />

    <qidi-box-settings-dialog
      v-if="settings"
      v-model="settings"
    />

    <qidi-box-tool-map-dialog
      v-if="mapping"
      v-model="mapping"
      :slots="slots"
      :tool-map="toolMap"
      :locked="mappingLocked"
    />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import { Waits } from '@/globals'
import QidiBoxMixin from '@/mixins/qidiBox'
import {
  QIDI_BOX_EXTERNAL_SLOT,
  qidiBoxReloadGroups,
  qidiBoxSlotLabel,
  type QidiBoxClimate,
  type QidiBoxReloadGroups,
  type QidiBoxSlot
} from '@/util/qidi-box'
import { QIDI_BOX_STEP_UNKNOWN, type QidiBoxError, type QidiBoxStepText } from '@/util/qidi-box-task'
import QidiBoxFlow from './QidiBoxFlow.vue'
import QidiBoxToolMapDialog from './QidiBoxToolMapDialog.vue'
import QidiBoxFilamentDialog from './QidiBoxFilamentDialog.vue'
import QidiBoxSettingsDialog from './QidiBoxSettingsDialog.vue'

const [EJECT, LOAD, UNLOAD] = [0, 1, 2]
// Firmware 01.01.07.01 replaced E_BOX, E_LOAD, E_UNLOAD, and RFID_READ with multi_color_controller commands.
const COMMANDS = ['EJECT_FILAMENT_CONTROL', 'LOAD_FILAMENT_CONTROL', 'UNLOAD_FILAMENT_CONTROL']
const LEGACY_COMMANDS = ['E_BOX', 'E_LOAD', 'E_UNLOAD']
// Qidi-Max-4-Optimized's slot jog moves a slot's motor whatever its sensors read.
const JOG_COMMAND = 'TLTG_BOX_SLOT_JOG'
const JOG_DISTANCE = 10

@Component({
  components: {
    QidiBoxFlow,
    QidiBoxToolMapDialog,
    QidiBoxFilamentDialog,
    QidiBoxSettingsDialog
  }
})
export default class QidiBoxCard extends Mixins(StateMixin, QidiBoxMixin) {
  readonly externalSlot = QIDI_BOX_EXTERNAL_SLOT
  readonly eject = EJECT
  readonly load = LOAD
  readonly unload = UNLOAD
  readonly jogDistance = JOG_DISTANCE

  selected = 0
  editing = false
  mapping = false
  settings = false

  get boxCount (): number {
    return this.$typedGetters['qidiBox/getBoxCount']
  }

  get slots (): QidiBoxSlot[] {
    return this.$typedGetters['qidiBox/getSlots']
  }

  get current (): QidiBoxSlot {
    return this.slots.find(slot => slot.index === this.selected) ?? this.slots[this.slots.length - 1]
  }

  get currentExternal (): boolean {
    return this.current.index === QIDI_BOX_EXTERNAL_SLOT
  }

  get toolMap (): Record<number, number> {
    return this.$typedGetters['qidiBox/getToolMap']
  }

  get toolsBySlot (): Record<number, string[]> {
    const tools: Record<number, string[]> = {}

    for (const [tool, slot] of Object.entries(this.toolMap)) {
      (tools[slot] = tools[slot] ?? []).push(`T${tool}`)
    }

    return tools
  }

  get loadedSlot (): number | null {
    return this.$typedGetters['qidiBox/getLoadedSlot']
  }

  get lastLoadSlot (): number | null {
    return this.$typedGetters['qidiBox/getLastLoadSlot']
  }

  get hub (): number | null {
    return this.$typedGetters['qidiBox/getHubSensor']
  }

  get autoReload (): boolean {
    return this.$typedGetters['qidiBox/getAutoReload']
  }

  get reloadGroups (): QidiBoxReloadGroups {
    return this.autoReload ? qidiBoxReloadGroups(this.slots) : {}
  }

  get climates (): Record<number, QidiBoxClimate> {
    return Object.fromEntries(Array.from({ length: this.boxCount }, (_, i) => [i + 1, this.climate(i + 1)]))
  }

  get busy (): boolean {
    return this.$typedGetters['qidiBox/getBusy']
  }

  get mappingLocked (): boolean {
    return this.$typedGetters['qidiBox/getMappingLocked']
  }

  get hasController (): boolean {
    return this.$typedGetters['qidiBox/getHasController']
  }

  get canEditFilament (): boolean {
    return this.hasController
      ? this.$typedState.qidiBox.filamentDatabase != null
      : this.$typedState.qidiBox.filamentList != null
  }

  get filamentDatabaseInvalid (): boolean {
    return this.hasController && this.$typedState.qidiBox.filamentDatabaseInvalid
  }

  // The hub and toolhead sensors are shared by every slot. The hub sees the loaded slot's filament, or, while it is
  // parked, unloading, or stranded by a failed load, the slot recorded at the hub or last loaded; the toolhead sees
  // only the loaded slot's.
  get hubSlot (): number | null {
    if (this.hub !== 0) return null

    return this.loadedSlot != null && this.loadedSlot !== QIDI_BOX_EXTERNAL_SLOT
      ? this.loadedSlot
      : this.$typedGetters['qidiBox/getHubSlot']
  }

  get toolheadSlot (): number | null {
    return this.$typedGetters['qidiBox/getToolheadFilament'] ? this.loadedSlot : null
  }

  get flowPaused (): boolean {
    return this.$typedGetters['qidiBox/getFlowPaused']
  }

  get taskText (): QidiBoxStepText | null {
    return this.$typedGetters['qidiBox/getTaskText']
  }

  // What the running flow is doing; never the raw step ID.
  get taskStep (): string | null {
    if (this.flowPaused || this.taskText == null) return null

    return this.stepText(this.taskText)
  }

  get failedStep (): string {
    const text = this.taskText

    if (text == null || text.key === QIDI_BOX_STEP_UNKNOWN) return this.$t('app.qidi_box.step.failed_unknown').toString()

    return this.$t('app.qidi_box.step.failed', { step: this.stepText(text) }).toString()
  }

  get lastError (): QidiBoxError | null {
    return this.$typedGetters['qidiBox/getLastError']
  }

  // The failed step's console error, then QIDI's Box warnings.
  get problems (): string[] {
    const error = this.lastError
    const problems = error ? [this.$t('app.qidi_box.msg.box_error', { ...error }).toString()] : []

    return [...new Set([...problems, ...this.$typedGetters['qidiBox/getWarnings']])]
  }

  get flowCommandDisabled (): boolean {
    return !this.klippyReady || this.hasWait(Waits.onQidiBoxFlow)
  }

  get strandedRecovery (): boolean {
    return this.$typedGetters['qidiBox/getStrandedRecovery'] && !this.hasWait(Waits.onQidiBoxFlow)
  }

  get strandedHint (): string {
    const slot = this.$typedGetters['qidiBox/getHubSlot']

    return slot != null
      ? this.$t('app.qidi_box.msg.stranded_slot', { slot: qidiBoxSlotLabel(slot) }).toString()
      : this.$t('app.qidi_box.msg.stranded').toString()
  }

  get overline (): string {
    const tools = this.toolsBySlot[this.current.index] ?? []

    return [
      this.currentExternal ? this.$t('app.qidi_box.label.external_spool') : this.$t('app.qidi_box.label.slot', { slot: this.current.label }),
      tools.length ? tools.join(', ') : this.$t('app.qidi_box.label.no_tool'),
      this.loadedSlot === this.current.index ? this.$t('app.qidi_box.label.loaded') : null
    ].filter(Boolean).join(' · ')
  }

  get details (): { key: string, icon: string | null, text: string }[] {
    const { present, vendor, type, color, minTemp, maxTemp, boxMaxTemp, reading } = this.current
    const filament = present ? [vendor, type, color].filter(Boolean).join(' · ') : ''

    return [
      filament ? { key: 'filament', icon: null, text: filament } : null,
      minTemp != null && maxTemp != null
        ? { key: 'nozzle', icon: '$printer3dNozzle', text: this.$t('app.qidi_box.msg.nozzle_range', { min: minTemp, max: maxTemp }).toString() }
        : null,
      boxMaxTemp != null && boxMaxTemp > 0
        ? { key: 'drying', icon: '$fire', text: this.$t('app.qidi_box.msg.box_drying', { temp: boxMaxTemp }).toString() }
        : null,
      reading ? { key: 'rfid', icon: '$qidiBoxRfid', text: this.$t('app.qidi_box.msg.reading_rfid').toString() } : null,
      present && !this.currentExternal ? { key: 'reload', icon: '$sync', text: this.reloadText } : null
    ].filter((detail): detail is { key: string, icon: string | null, text: string } => detail != null)
  }

  get reloadText (): string {
    if (!this.autoReload) return this.$t('app.qidi_box.msg.auto_reload_off').toString()

    const group = this.reloadGroups[this.current.index]

    if (!group) return this.$t('app.qidi_box.msg.no_reload_backup').toString()

    return this.$t('app.qidi_box.msg.reload_with', {
      slots: group.members.filter(member => member !== this.current.index).map(qidiBoxSlotLabel).join(', ')
    }).toString()
  }

  get slotControlsDisabled (): boolean {
    return this.busy || this.currentExternal || !this.current.present
  }

  get canJog (): boolean {
    return JOG_COMMAND in this.$typedGetters['printer/getAvailableCommands']
  }

  // The jog refuses only while printing, paused, or the Box is busy, so an empty slot can still move.
  get jogDisabled (): boolean {
    return this.mappingLocked || this.currentExternal
  }

  @Watch('boxCount')
  onBoxCountChanged () {
    if (!this.slots.some(slot => slot.index === this.selected)) this.selected = this.loadedSlot ?? 0
  }

  @Watch('klippyReady')
  @Watch('hasController', { immediate: true })
  onFilamentSourceChanged () {
    if (this.klippyReady) this.loadQidiBoxFilaments()
  }

  created () {
    if (this.loadedSlot != null) this.selected = this.loadedSlot
  }

  climate (box: number): QidiBoxClimate {
    const sensor = this.$typedState.printer.printer[`aht20_f heater_box${box}`]
    const target = this.$typedState.printer.printer[`heater_generic heater_box${box}`]?.target

    return {
      humidity: sensor?.humidity != null ? Math.round(sensor.humidity) : null,
      temperature: sensor?.temperature != null ? Math.round(sensor.temperature) : null,
      target: target != null && target > 0 ? Math.round(target) : null
    }
  }

  // Filament at the inlet allows Eject and Load; the slot that last loaded, with filament at the hub, allows
  // Unload instead of Load. Filament stranded between the hub and the toolhead allows Unload and Eject even while a
  // failed flow is paused; Qidi-Max-4-Optimized picks the slot at the hub and refuses any other. The external spool
  // has no Box controls.
  actionDisabled (action: number): boolean {
    if (this.strandedRecovery && action !== LOAD && !this.currentExternal && this.current.present) return false
    if (this.slotControlsDisabled) return true

    const loaded = this.hub === 0 && this.lastLoadSlot === this.current.index

    if (action === LOAD) return loaded
    if (action === UNLOAD) return !loaded

    return false
  }

  sendAction (action: number) {
    if (this.actionDisabled(action)) return

    const { index } = this.current

    this.sendGcode(this.hasController ? `${COMMANDS[action]} SLOT=${index}` : `${LEGACY_COMMANDS[action]} slot=${index}`)
  }

  readRfid () {
    if (this.slotControlsDisabled) return

    const { index } = this.current

    this.sendGcode(this.hasController ? `READ_RFID SLOT=${index}` : `RFID_READ SLOT=slot${index}`)
  }

  stepText (text: QidiBoxStepText): string {
    return this.$t(`app.qidi_box.step.${text.key}`, text.params).toString()
  }

  sendFlowCommand (command: 'FLOW_RETRY' | 'FLOW_STOP') {
    if (this.flowCommandDisabled) return

    this.sendGcode(command, Waits.onQidiBoxFlow)
  }

  jog (distance: number) {
    if (this.jogDisabled) return

    this.sendGcode(`${JOG_COMMAND} SLOT=${this.current.index} DISTANCE=${distance}`)
  }

  handleToolClick (entry: { tool: number, slot: number }) {
    if (this.mappingLocked) {
      this.selected = entry.slot
    } else {
      this.mapping = true
    }
  }
}
</script>

<style lang="scss" scoped>
// Shared by the flow, units, spools, and nozzle. The surface matches the card (Vuetify's elevation 1), so labels and
// spool holes can mask the strands behind them.
.theme--dark .qidi-box-card {
  --qidi-box-surface: #{map-get($material-dark-elevation-colors, '1')};
  --qidi-box-block: #3a3a3d;
  --qidi-box-edge: rgba(255, 255, 255, 0.35);
  --qidi-box-contrast: rgba(255, 255, 255, 0.7);
  --qidi-box-muted: rgba(255, 255, 255, 0.38);
  --qidi-box-track: rgba(255, 255, 255, 0.14);
  --qidi-box-line: rgba(255, 255, 255, 0.12);
  --qidi-box-tint: rgba(255, 255, 255, 0.06);
}

.theme--light .qidi-box-card {
  --qidi-box-surface: #ffffff;
  --qidi-box-block: #dcdcdf;
  --qidi-box-edge: rgba(0, 0, 0, 0.35);
  --qidi-box-contrast: rgba(0, 0, 0, 0.6);
  --qidi-box-muted: rgba(0, 0, 0, 0.38);
  --qidi-box-track: rgba(0, 0, 0, 0.12);
  --qidi-box-line: rgba(0, 0, 0, 0.12);
  --qidi-box-tint: rgba(0, 0, 0, 0.04);
}

.qidi-box-card__sheet {
  background: var(--qidi-box-tint);
}

.qidi-box-card__overline {
  line-height: 1.6;
}

.qidi-box-card__name {
  gap: 8px;
}

.qidi-box-card__swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(128, 128, 128, 0.6);
}

.qidi-box-card__details {
  gap: 4px 14px;
}

.qidi-box-card__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 6px;
}

.qidi-box-card__failure-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.qidi-box-card__wide {
  grid-column: 1 / -1;
}
</style>
