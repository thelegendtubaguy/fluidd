<template>
  <div class="bed-soak-chart">
    <div class="bed-soak-chart__head">
      <span class="bed-soak-chart__title">{{ title }}</span>
      <span
        v-if="note"
        class="bed-soak-chart__note"
      >{{ note }}</span>
      <span
        v-if="series.length > 1"
        class="bed-soak-chart__legend"
      >
        <span
          v-for="item in series"
          :key="`legend:${item.name}`"
          class="bed-soak-chart__legend-item"
        >
          <i :style="{ background: item.color }" />{{ item.name }}
        </span>
      </span>
      <v-spacer />
      <span class="bed-soak-chart__unit">{{ unit }}</span>
    </div>
    <div
      class="bed-soak-chart__chart"
      :style="{ height: $filters.getPixelsString(height) }"
    >
      <e-chart
        ref="chart"
        :option="options"
        :group="group"
        :update-options="updateOptions"
        :init-options="initOptions"
        autoresize
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Mixins } from 'vue-property-decorator'
import type { EChartsInitOpts, EChartsOption, SetOptionOpts, LineSeriesOption } from 'echarts'
import BrowserMixin from '@/mixins/browser'

export interface BedSoakChartPoint {
  value: [number, number];
  name?: string;
}

export interface BedSoakChartSeries {
  name: string;
  color: string;
  data: BedSoakChartPoint[];
  /** Draw a dot at every point, for one point per mesh */
  markers?: boolean;
  format: (value: number) => string;
}

export interface BedSoakChartEvent {
  /** Minutes */
  x: number;
  label: string;
}

export interface BedSoakChartReference {
  y: number;
  label?: string;
  color?: string;
}

const connectedGroups = new Set<string>()

// One value axis per chart. Charts in the same group share their crosshair, and
// are given the same time range by their parent, so their time axes line up.
@Component({})
export default class BedSoakChart extends Mixins(BrowserMixin) {
  @Prop({ type: String, required: true })
  readonly title!: string

  @Prop({ type: String })
  readonly note?: string

  @Prop({ type: String, required: true })
  readonly unit!: string

  @Prop({ type: Array, required: true })
  readonly series!: BedSoakChartSeries[]

  @Prop({ type: Number, required: true })
  readonly xMin!: number

  @Prop({ type: Number, required: true })
  readonly xMax!: number

  @Prop({ type: Number })
  readonly yMin?: number

  @Prop({ type: Number })
  readonly yMax?: number

  @Prop({ type: Array, default: () => [] })
  readonly events!: BedSoakChartEvent[]

  @Prop({ type: Array, default: () => [] })
  readonly references!: BedSoakChartReference[]

  @Prop({ type: Object })
  readonly band?: { from: number, to: number, color: string }

  @Prop({ type: String })
  readonly group?: string

  @Prop({ type: Number, default: 150 })
  readonly height!: number

  @Prop({ type: Function, required: true })
  readonly timeLabel!: (minutes: number) => string

  readonly updateOptions: SetOptionOpts = Object.freeze({ notMerge: true })
  readonly initOptions: EChartsInitOpts = Object.freeze({ renderer: 'canvas' })

  mounted () {
    const group = this.group

    if (group && !connectedGroups.has(group)) {
      connectedGroups.add(group)

      import('echarts/core').then(({ connect }) => connect(group))
    }
  }

  get isDark (): boolean {
    return this.$typedState.config.uiSettings.theme.isDark
  }

  get options (): EChartsOption {
    const isDark = this.isDark
    const fontColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)'
    const strongColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)'
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
    const axisColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'
    const eventColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
    const fontSize = 11

    // Event labels sit above the plot, staggered so labels close in time don't overlap
    const rows: number[] = []
    const eventRows = this.events.map(event => {
      let row = 0
      while (rows[row] != null && event.x - rows[row] < (this.xMax - this.xMin) * 0.3) row++
      rows[row] = event.x
      return row
    })
    const top = 10 + (this.events.length > 0 ? 14 * (Math.max(...eventRows) + 1) : 0)

    const markLineData = [
      ...this.events.map((event, i) => ({
        xAxis: event.x,
        lineStyle: {
          color: eventColor,
          type: [2, 3] as number[],
          width: 1
        },
        label: {
          show: true,
          formatter: event.label,
          position: 'end' as const,
          distance: [0, 2 + 14 * eventRows[i]],
          color: fontColor,
          fontSize
        }
      })),
      ...this.references.map(reference => ({
        yAxis: reference.y,
        lineStyle: {
          color: reference.color ?? eventColor,
          type: [4, 4] as number[],
          width: 1
        },
        label: {
          show: reference.label != null,
          formatter: reference.label ?? '',
          position: 'insideStartTop' as const,
          color: reference.color ?? fontColor,
          fontSize
        }
      }))
    ]

    const series: LineSeriesOption[] = this.series.map((item, i) => ({
      type: 'line',
      name: item.name,
      data: item.data,
      color: item.color,
      showSymbol: !!item.markers,
      symbol: 'circle',
      symbolSize: item.markers ? 7 : 4,
      itemStyle: {
        color: item.color,
        borderColor: isDark ? '#28282b' : '#ffffff',
        borderWidth: item.markers ? 1.5 : 0
      },
      lineStyle: {
        width: 2,
        color: item.color
      },
      emphasis: {
        disabled: true
      },
      connectNulls: false,
      endLabel: {
        show: item.data.length > 0,
        formatter: (params: any) => item.format(params.value[1]),
        color: strongColor,
        fontSize: 12,
        distance: 6
      },
      labelLayout: {
        moveOverlap: 'shiftY'
      },
      ...(i === 0
        ? {
            markLine: {
              silent: true,
              symbol: 'none',
              animation: false,
              data: markLineData
            },
            ...(this.band
              ? {
                  markArea: {
                    silent: true,
                    itemStyle: {
                      color: this.band.color
                    },
                    data: [[{ yAxis: this.band.from }, { yAxis: this.band.to }]]
                  }
                }
              : {})
          }
        : {})
    }))

    return {
      animation: false,
      textStyle: {
        fontFamily: 'Roboto'
      },
      grid: {
        top,
        left: 44,
        right: 78,
        bottom: 22
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: isDark ? 'rgba(15,15,15,0.9)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        textStyle: {
          color: strongColor,
          fontSize: 12
        },
        axisPointer: {
          type: 'line',
          snap: false,
          lineStyle: {
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
          }
        },
        formatter: (params: any) => {
          const items: any[] = Array.isArray(params) ? params : [params]

          if (items.length === 0) return ''

          const rows = items
            .filter(param => Array.isArray(param.value))
            .map(param => {
              const item = this.series.find(item => item.name === param.seriesName)
              const value = item ? item.format(param.value[1]) : param.value[1]
              const at = param.name ? ` · ${param.name}` : ''

              return `<div>${param.marker}<b>${value}</b> <span style="color:${fontColor}">${param.seriesName}${at}</span></div>`
            })
            .join('')

          return `<div style="color:${fontColor};margin-bottom:2px">${this.timeLabel(items[0].axisValue)}</div>${rows}`
        }
      },
      xAxis: {
        type: 'value',
        min: this.xMin,
        max: this.xMax,
        axisTick: {
          show: false
        },
        axisLine: {
          lineStyle: {
            color: axisColor
          }
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          color: fontColor,
          fontSize,
          showMinLabel: false,
          formatter: (value: number) => value === 0 ? '0 min' : `${value}`
        }
      },
      yAxis: {
        type: 'value',
        min: this.yMin,
        max: this.yMax,
        scale: this.yMin == null,
        splitNumber: 4,
        axisLabel: {
          color: fontColor,
          fontSize
        },
        splitLine: {
          lineStyle: {
            color: gridColor
          }
        }
      },
      series
    }
  }
}
</script>

<style lang="scss" scoped>
  .bed-soak-chart__head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    column-gap: 14px;
    font-size: 0.8125rem;
    margin-top: 4px;
  }

  .bed-soak-chart__title {
    font-weight: 500;
  }

  .bed-soak-chart__note,
  .bed-soak-chart__unit {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .bed-soak-chart__legend {
    display: inline-flex;
    flex-wrap: wrap;
    column-gap: 14px;
    font-size: 0.75rem;
    opacity: 0.85;
  }

  .bed-soak-chart__legend-item {
    white-space: nowrap;
  }

  .bed-soak-chart__legend-item i {
    display: inline-block;
    width: 14px;
    height: 2px;
    margin-right: 6px;
    vertical-align: middle;
    border-radius: 1px;
  }

  .bed-soak-chart__chart {
    width: 100%;
  }
</style>
