<template>
  <collapsable-card
    :title="$t('app.system_info.label.system_utilization')"
    icon="$chart"
  >
    <v-card-text>
      <v-row>
        <system-load-chart />
        <klipper-load-chart />
        <klipper-timers-chart v-if="hasKlipperHealth" />
        <moonraker-load-chart />
        <system-memory-chart />
        <mcu-load-chart
          v-for="mcu in mcus"
          :key="mcu.key"
          :mcu="mcu"
        />
      </v-row>
    </v-card-text>
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import SystemLoadChart from './SystemLoadChart.vue'
import SystemMemoryChart from './SystemMemoryChart.vue'
import KlipperLoadChart from './KlipperLoadChart.vue'
import KlipperTimersChart from './KlipperTimersChart.vue'
import MoonrakerLoadChart from './MoonrakerLoadChart.vue'
import McuLoadChart from './McuLoadChart.vue'
import type { MCU } from '@/store/printer/types'

@Component({
  components: {
    SystemLoadChart,
    SystemMemoryChart,
    KlipperLoadChart,
    KlipperTimersChart,
    MoonrakerLoadChart,
    McuLoadChart
  }
})
export default class PrinterStatsCard extends Vue {
  get procStats (): Moonraker.ProcStats.MoonrakerStats[] {
    return this.$typedState.server.moonraker_stats
  }

  get systemStats (): Klipper.SystemStatsState {
    return this.$typedState.printer.printer.system_stats
  }

  get hasKlipperHealth (): boolean {
    return this.$typedState.printer.printer.tltg_klipper_health != null
  }

  get mcus (): MCU[] {
    return this.$typedGetters['printer/getMcus']
  }
}
</script>
