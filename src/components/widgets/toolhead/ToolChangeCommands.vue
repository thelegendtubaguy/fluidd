<template>
  <v-row v-if="toolChangeCommands.length > 0">
    <v-col
      v-for="(toolChangeCommandsGroup, index2) in toolChangeCommandsGrouped"
      :key="index2"
      cols="12"
    >
      <app-btn-group
        class="app-toolchanger-control d-flex"
        :class="{
          [$vuetify.theme.dark ? 'theme--dark': 'theme--light']: true,
        }"
      >
        <v-tooltip
          v-for="(macro, index) of toolChangeCommandsGroup"
          :key="index"
          top
        >
          <template #activator="{ on, attrs }">
            <app-btn
              v-bind="attrs"
              min-width="10"
              :color="macro.active ? 'primary' : undefined"
              :disabled="!klippyReady || printerPrinting || qidiBoxBusy"
              class="px-0 flex-grow-1"
              :class="{ 'tool-active': macro.active }"
              v-on="on"
              @click="sendGcode(macro.name)"
            >
              <v-icon
                v-if="macro.spoolId && getSpoolById(macro.spoolId)"
                class="mr-1 spool-icon"
                :color="getSpoolColor(getSpoolById(macro.spoolId))"
              >
                $filament
              </v-icon>
              <span
                v-else-if="macro.color"
                class="extruder-color mr-1"
                :class="{
                  active: macro.active
                }"
                :style="{
                  background: macro.color
                }"
              />
              {{ macro.name }}
            </app-btn>
          </template>
          {{ macro.description }}
        </v-tooltip>
      </app-btn-group>
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import type { GcodeCommands } from '@/store/printer/types'
import type { TranslateResult } from 'vue-i18n'
import type { Spool } from '@/store/spoolman/types'
import { chunk } from 'lodash-es'
import type { Macro } from '@/store/macros/types'
import type { QidiBoxToolButton } from '@/util/qidi-box'

type ToolChangeCommand = {
  name: string,
  description: string | TranslateResult,
  color?: string,
  active?: boolean,
  spoolId?: number
}

@Component({})
export default class ToolChangeCommands extends Mixins(StateMixin) {
  get availableCommands (): GcodeCommands {
    return this.$typedGetters['printer/getAvailableCommands']
  }

  get qidiBoxManagesTools (): boolean {
    return this.$typedGetters['qidiBox/getManagesTools']
  }

  get qidiBoxBusy (): boolean {
    return this.qidiBoxManagesTools && this.$typedGetters['qidiBox/getBusy']
  }

  // A tool's Box slot color, with its slot and filament in the tooltip.
  get qidiBoxToolChangeCommands (): ToolChangeCommand[] {
    const buttons: QidiBoxToolButton[] = this.$typedGetters['qidiBox/getToolButtons']
    const commands = new Set(Object.keys(this.availableCommands).map(command => command.toUpperCase()))

    return buttons
      .filter(button => commands.has(`T${button.tool}`))
      .map(({ tool, slot, active }) => ({
        name: `T${tool}`,
        description: `${slot.label} · ${slot.present
          ? slot.name || this.$t('app.qidi_box.label.unknown_filament')
          : this.$t('app.qidi_box.label.empty')}`,
        color: slot.present ? slot.color ?? undefined : undefined,
        active
      }))
  }

  get toolChangeCommands (): ToolChangeCommand[] {
    if (this.qidiBoxManagesTools) return this.qidiBoxToolChangeCommands

    const availableCommands = this.availableCommands

    return Object.keys(availableCommands)
      .filter(command => /^t\d+$/i.test(command))
      .map((command): ToolChangeCommand => {
        const { help } = availableCommands[command]
        const description = help && help !== 'G-Code macro'
          ? help
          : this.$t('app.tool.tooltip.select_tool', { tool: command.substring(1) })

        const macro: Macro | undefined = this.$typedGetters['macros/getMacroByName'](command)

        return {
          name: command,
          description,
          color: macro?.variables?.color ? `#${macro.variables.color}` : undefined,
          active: Boolean(macro?.variables?.active),
          spoolId: macro?.variables?.spool_id ? +macro.variables.spool_id : undefined
        }
      })
      .sort((a, b) => +a.name.substring(1) - +b.name.substring(1))
  }

  get toolChangeCommandsGrouped (): ToolChangeCommand[][] {
    const toolChangeCommands = this.toolChangeCommands

    const cols = Math.ceil(toolChangeCommands.length / Math.ceil(toolChangeCommands.length / 6))

    return chunk(toolChangeCommands, cols)
  }

  getSpoolById (id: number): Spool | undefined {
    return this.$typedGetters['spoolman/getSpoolById'](id)
  }

  getSpoolColor (spool: Spool | undefined) {
    return spool?.filament.color_hex ?? (this.$vuetify.theme.dark ? '#fff' : '#000')
  }
}
</script>

<style lang="scss" scoped>
  @import 'vuetify/src/styles/styles.sass';

  @include theme(app-toolchanger-control) using ($material) {
    .extruder-color {
      border-color: map-deep-get($material, 'text', 'primary');
    }
  }

  .app-toolchanger-control .extruder-color {
    width: 15px;
    height: 15px;
    border-width: 1px;
    border-style: solid;
    border-radius: 50%;

    &.active {
      border-color: map-deep-get($material-dark, 'text', 'primary');
    }
  }

  // Disabled buttons drop their color while printing, so the active tool also gets a bar that stays.
  .app-toolchanger-control .tool-active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background-color: var(--v-primary-base);
  }
</style>
