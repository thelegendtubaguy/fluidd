<template>
  <app-inline-chart
    :data="chartData"
    :options="options"
    :labels="labels"
  />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import type { EChartsOption, LineSeriesOption } from 'echarts'
import type { AppInlineChartLabel } from '@/components/ui/AppInlineChart.vue'
import type { ChartDataSource } from '@/store/charts/types'
import { chartBufferSource } from '@/util/chart-buffer'

// QIDI Max 4 Optimized's tltg_klipper_health: Klipper walks every timer on
// each pass of its main loop, so a count that keeps climbing slows it down.
@Component({})
export default class KlipperTimersChart extends Vue {
  get chartData (): ChartDataSource {
    return chartBufferSource(this.$typedState.charts.klipper)
  }

  get labels (): AppInlineChartLabel[] {
    return [
      {
        text: this.$t('app.system_info.label.klipper_timers').toString(),
        value: 'timers',
        decimals: 0
      }
    ]
  }

  get options (): EChartsOption {
    const options: EChartsOption = {
      ...this.$typedGetters['charts/getBaseChartOptions']({
        timers: ''
      }),
      series: this.series
    }

    // A count, not a percentage: scale to the data with some headroom.
    if (
      options.yAxis &&
      !Array.isArray(options.yAxis)
    ) {
      options.yAxis.min = 0
      options.yAxis.max = (value) => Math.max(100, Math.ceil(value.max * 1.2 / 50) * 50)
    }

    return options
  }

  get series (): LineSeriesOption {
    return {
      ...this.$typedGetters['charts/getBaseSeries'],
      name: this.$t('app.system_info.label.timers').toString(),
      encode: {
        x: 'date',
        y: 'timers'
      }
    }
  }
}
</script>
