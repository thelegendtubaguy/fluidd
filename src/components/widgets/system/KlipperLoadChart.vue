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

@Component({})
export default class KlipperLoadChart extends Vue {
  get chartData (): ChartDataSource {
    return chartBufferSource(this.$typedState.charts.klipper)
  }

  // QIDI Max 4 Optimized reports Klipper's main thread on its own, which is
  // the thread that has to keep up with endstops and heaters.
  get hasMainThread (): boolean {
    return this.$typedState.printer.printer.tltg_klipper_health != null
  }

  get labels (): AppInlineChartLabel[] {
    const labels: AppInlineChartLabel[] = [
      {
        text: this.$t('app.system_info.label.klipper_load').toString(),
        value: 'cputime_change',
        suffix: ' %'
      }
    ]

    if (this.hasMainThread) {
      labels.push({
        text: this.$t('app.system_info.label.klipper_main_thread').toString(),
        value: 'main_thread',
        suffix: ' %'
      })
    }

    return labels
  }

  get options (): EChartsOption {
    return {
      ...this.$typedGetters['charts/getBaseChartOptions']({
        cputime_change: ' %',
        main_thread: ' %'
      }),
      series: this.series
    }
  }

  get series (): LineSeriesOption[] {
    const series: LineSeriesOption[] = [
      {
        ...this.$typedGetters['charts/getBaseSeries'],
        name: this.$t('app.system_info.label.load').toString(),
        encode: {
          x: 'date',
          y: 'cputime_change'
        }
      }
    ]

    if (this.hasMainThread) {
      series.push({
        ...this.$typedGetters['charts/getBaseSeries'],
        name: this.$t('app.system_info.label.main_thread').toString(),
        encode: {
          x: 'date',
          y: 'main_thread'
        }
      })
    }

    return series
  }
}
</script>
