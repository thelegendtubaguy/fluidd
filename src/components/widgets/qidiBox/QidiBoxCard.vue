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

    <div class="pa-3">
      <div class="d-flex flex-wrap qidi-box-card__units">
        <qidi-box-unit
          v-for="box in boxCount"
          :key="box"
          :title="$t('app.qidi_box.label.box', { box })"
          :slots="slots.filter(slot => slot.index !== externalSlot && Math.floor(slot.index / 4) === box - 1)"
          :selected="selected"
          :loaded-slot="loadedSlot"
          :tools-by-slot="toolsBySlot"
          :reload-groups="reloadGroups"
          :climate="climate(box)"
          @select="selected = $event"
        />
        <qidi-box-unit
          :title="$t('app.qidi_box.label.external')"
          :slots="slots.filter(slot => slot.index === externalSlot)"
          :selected="selected"
          :loaded-slot="loadedSlot"
          :tools-by-slot="toolsBySlot"
          :reload-groups="reloadGroups"
          @select="selected = $event"
        />
      </div>

      <div class="d-flex flex-wrap mt-3 qidi-box-card__detail">
        <div class="d-flex flex-column align-center qidi-box-card__path">
          <div class="text-caption text--secondary mb-1">
            {{ statusText }}
          </div>
          <qidi-box-path
            :box-slot="current"
            :at-hub="!currentExternal && hubSlot === current.index"
            :at-toolhead="toolheadSlot === current.index"
          />
        </div>

        <div class="qidi-box-card__summary">
          <div class="px-2 pb-2">
            <div class="text-overline text--secondary qidi-box-card__overline">
              {{ overline }}
            </div>
            <div
              v-if="current.present && current.name"
              class="text-h6 d-flex align-center qidi-box-card__name"
            >
              <span
                class="qidi-box-card__swatch"
                :style="{ backgroundColor: current.color || 'transparent' }"
              />
              {{ current.name }}
            </div>
            <div
              v-else
              class="text-h6 text--secondary"
            >
              {{ current.present ? $t('app.qidi_box.label.unknown_filament') : $t('app.qidi_box.label.empty') }}
            </div>
            <div
              v-if="current.present"
              class="text-body-2 text--secondary"
            >
              {{ [current.vendor, current.type, current.color].filter(Boolean).join(' · ') }}
            </div>
            <div
              v-if="temperatures"
              class="text-caption text--disabled"
            >
              {{ temperatures }}
            </div>
            <div
              v-if="current.present && !currentExternal"
              class="text-caption text--secondary d-flex align-center"
            >
              <v-icon
                x-small
                class="mr-1"
              >
                $sync
              </v-icon>
              {{ reloadText }}
            </div>
          </div>

          <v-divider />

          <div class="pa-2 qidi-box-card__controls">
            <app-btn
              small
              block
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
              block
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
              block
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
              block
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
            <app-btn
              v-if="canEditFilament"
              small
              block
              class="qidi-box-card__wide"
              :disabled="busy || !current.present"
              @click="editing = true"
            >
              <v-icon
                small
                left
              >
                $pencil
              </v-icon>
              {{ $t('app.qidi_box.btn.edit_filament') }}
            </app-btn>
          </div>
        </div>
      </div>

      <v-divider class="mt-2" />

      <qidi-box-tool-map
        :slots="slots"
        :tool-map="toolMap"
        :selected="selected"
        :loaded-slot="loadedSlot"
        :locked="mappingLocked"
        @select="selected = $event"
        @tool-click="handleToolClick"
        @edit="mapping = true"
      />
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
import QidiBoxMixin from '@/mixins/qidiBox'
import {
  QIDI_BOX_EXTERNAL_SLOT,
  qidiBoxReloadGroups,
  qidiBoxSlotLabel,
  type QidiBoxSlot
} from '@/util/qidi-box'
import QidiBoxUnit, { type QidiBoxClimate, type QidiBoxReloadGroups } from './QidiBoxUnit.vue'
import QidiBoxPath from './QidiBoxPath.vue'
import QidiBoxToolMap from './QidiBoxToolMap.vue'
import QidiBoxToolMapDialog from './QidiBoxToolMapDialog.vue'
import QidiBoxFilamentDialog from './QidiBoxFilamentDialog.vue'
import QidiBoxSettingsDialog from './QidiBoxSettingsDialog.vue'

const [EJECT, LOAD, UNLOAD] = [0, 1, 2]
// Firmware 01.01.07.01 replaced E_BOX, E_LOAD, E_UNLOAD, and RFID_READ with multi_color_controller commands.
const COMMANDS = ['EJECT_FILAMENT_CONTROL', 'LOAD_FILAMENT_CONTROL', 'UNLOAD_FILAMENT_CONTROL']
const LEGACY_COMMANDS = ['E_BOX', 'E_LOAD', 'E_UNLOAD']

@Component({
  components: {
    QidiBoxUnit,
    QidiBoxPath,
    QidiBoxToolMap,
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

  // The hub and toolhead sensors are shared by every slot. The hub sees the loaded slot's filament, or the
  // last-loaded slot's while it is parked or unloading; the toolhead sees only the loaded slot's.
  get hubSlot (): number | null {
    if (this.hub !== 0) return null

    return this.loadedSlot != null && this.loadedSlot !== QIDI_BOX_EXTERNAL_SLOT ? this.loadedSlot : this.lastLoadSlot
  }

  get toolheadSlot (): number | null {
    return this.$typedGetters['qidiBox/getToolheadFilament'] ? this.loadedSlot : null
  }

  get statusText (): string {
    const task = this.$typedGetters['qidiBox/getTask']

    if (task) {
      return task.current_step
        ? this.$t('app.qidi_box.msg.box_busy_step', { step: task.current_step }).toString()
        : this.$t('app.qidi_box.msg.box_busy').toString()
    }

    if (this.loadedSlot == null) return this.$t('app.qidi_box.msg.no_filament_loaded').toString()

    const tools = this.toolsBySlot[this.loadedSlot] ?? []
    const loaded = this.$t('app.qidi_box.msg.loaded', { slot: qidiBoxSlotLabel(this.loadedSlot) }).toString()

    return tools.length ? `${loaded} (${tools.join(', ')})` : loaded
  }

  get overline (): string {
    const tools = this.toolsBySlot[this.current.index] ?? []

    return [
      this.currentExternal ? this.$t('app.qidi_box.label.external_spool') : this.$t('app.qidi_box.label.slot', { slot: this.current.label }),
      tools.length ? tools.join(', ') : this.$t('app.qidi_box.label.no_tool'),
      this.loadedSlot === this.current.index ? this.$t('app.qidi_box.label.loaded') : null
    ].filter(Boolean).join(' · ')
  }

  get temperatures (): string {
    const { minTemp, maxTemp, boxMaxTemp, reading } = this.current

    return [
      minTemp != null && maxTemp != null ? this.$t('app.qidi_box.msg.nozzle_range', { min: minTemp, max: maxTemp }) : null,
      boxMaxTemp != null && boxMaxTemp > 0 ? this.$t('app.qidi_box.msg.box_drying', { temp: boxMaxTemp }) : null,
      reading ? this.$t('app.qidi_box.msg.reading_rfid') : null
    ].filter(Boolean).join(' · ')
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

  @Watch('boxCount')
  onBoxCountChanged () {
    if (!this.slots.some(slot => slot.index === this.selected)) this.selected = this.loadedSlot ?? 0
  }

  @Watch('hasController', { immediate: true })
  onHasControllerChanged () {
    this.loadQidiBoxFilaments()
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
  // Unload instead of Load. The external spool has no Box controls.
  actionDisabled (action: number): boolean {
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

  handleToolClick (entry: { tool: number, slot: number }) {
    if (this.mappingLocked) {
      this.selected = entry.slot
    } else {
      this.mapping = true
    }
  }
}
</script>

<style scoped>
.qidi-box-card__units {
  gap: 12px;
}

.qidi-box-card__detail {
  gap: 8px;
}

.qidi-box-card__path {
  flex: 1 1 200px;
}

.qidi-box-card__summary {
  flex: 1 1 280px;
}

.qidi-box-card__overline {
  line-height: 1.6;
}

.qidi-box-card__name {
  gap: 8px;
}

.qidi-box-card__swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(128, 128, 128, 0.6);
}

.qidi-box-card__controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.qidi-box-card__wide {
  grid-column: span 2;
}
</style>
