<template>
  <app-dialog
    v-model="open"
    :title="$t('app.qidi_box.settings.title')"
    width="720"
    no-actions
  >
    <v-card-text class="pa-0">
      <template v-for="(setting, i) in settings">
        <v-divider
          v-if="i > 0"
          :key="`divider-${setting.variable}`"
        />
        <app-setting
          :key="setting.variable"
          :title="$t(`app.qidi_box.settings.${setting.variable}`)"
          :sub-title="$t(`app.qidi_box.settings.${setting.variable}_help`)"
        >
          <v-switch
            :input-value="setting.value"
            :disabled="!klippyReady"
            class="mt-0"
            hide-details
            @change="save(setting.variable, $event)"
          />
        </app-setting>
      </template>
    </v-card-text>

    <template v-if="hasMotion">
      <v-divider />
      <v-card-text class="pt-3">
        <qidi-box-motion />
      </v-card-text>
    </template>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Mixins, VModel } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import QidiBoxMotion from './QidiBoxMotion.vue'

// QIDI's Box settings, saved variables read by its Box modules; set to 1 or 0 as QIDI's Fluidd did.
const VARIABLES = ['auto_read_rfid', 'auto_init_detect', 'auto_reload_detect']

@Component({
  components: { QidiBoxMotion }
})
export default class QidiBoxSettingsDialog extends Mixins(StateMixin) {
  @VModel({ type: Boolean })
  open!: boolean

  get settings () {
    const variables = this.$typedState.printer.printer.save_variables?.variables ?? {}

    return VARIABLES.map(variable => ({ variable, value: Number(variables[variable] ?? 0) === 1 }))
  }

  get hasMotion (): boolean {
    return this.$typedState.printer.printer.tltg_box_feed_motion != null
  }

  save (variable: string, value: boolean) {
    this.sendGcode(`SAVE_VARIABLE VARIABLE=${variable} VALUE=${value ? 1 : 0}`)
  }
}
</script>
