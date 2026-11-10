<template>
  <div class="bed-soak-run-charts">
    <bed-soak-chart
      :title="$t('app.bed_soak.label.temperature')"
      unit="°C"
      :series="temperatureSeries"
      :x-min="xRange.min"
      :x-max="xRange.max"
      :events="temperatureEvents"
      :references="temperatureReferences"
      :group="group"
      :time-label="timeLabel"
      :height="150"
    />
    <bed-soak-chart
      :title="$t('app.bed_soak.label.movement')"
      unit="µm"
      :series="movementSeries"
      :x-min="xRange.min"
      :x-max="xRange.max"
      :events="movementEvents"
      :group="group"
      :time-label="timeLabel"
      :height="150"
    />
    <bed-soak-chart
      :title="$t('app.bed_soak.label.still_moving')"
      :note="$t('app.bed_soak.label.still_moving_note')"
      :unit="$t('app.bed_soak.label.um_per_min')"
      :series="speedSeries"
      :x-min="xRange.min"
      :x-max="xRange.max"
      :y-min="0"
      :events="movementEvents"
      :references="speedReferences"
      :band="speedBand"
      :group="group"
      :time-label="timeLabel"
      :height="120"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import BedSoakChart, { type BedSoakChartEvent, type BedSoakChartReference, type BedSoakChartSeries } from './BedSoakChart.vue'
import { BedSoakColors, type BedSoakRun, type BedSoakTemp } from '@/util/tltg-bed-soak'
import { bedSoakClock, bedSoakMeshName } from './bed-soak-format'

let nextGroup = 0

@Component({
  components: {
    BedSoakChart
  }
})
export default class BedSoakRunCharts extends Vue {
  @Prop({ type: Object, required: true })
  readonly run!: BedSoakRun

  @Prop({ type: Array, required: true })
  readonly temps!: BedSoakTemp[]

  @Prop({ type: Object, required: true })
  readonly milestones!: Klipper.TltgBedSoakMilestones

  /** Seconds since the heaters turned on, while the test runs */
  @Prop({ type: Number })
  readonly elapsed?: number

  readonly group = `bed-soak-run-${nextGroup++}`

  get speedLimit (): number {
    return (this.run.settings.limits.speed ?? 0.002) * 1000
  }

  get usedMeshes () {
    return this.run.meshes.filter(mesh => mesh.used)
  }

  get xRange () {
    const times = [
      0,
      ...(this.temps.length > 0 ? [this.temps[0][0], this.temps[this.temps.length - 1][0]] : []),
      ...this.run.meshes.flatMap(mesh => [mesh.start ?? mesh.time, mesh.end ?? mesh.time]),
      this.elapsed ?? 0
    ].map(time => time / 60)

    const min = Math.floor(Math.min(...times))
    const max = Math.max(min + 10, Math.ceil(Math.max(...times) / 5) * 5)

    return { min, max }
  }

  timeLabel (minutes: number) {
    return minutes < 0
      ? this.$t('app.bed_soak.label.before_heaters_on', { time: bedSoakClock(-minutes * 60) }).toString()
      : this.$t('app.bed_soak.label.after_heaters_on', { time: bedSoakClock(minutes * 60) }).toString()
  }

  get temperatureSeries (): BedSoakChartSeries[] {
    const format = (value: number) => `${value.toFixed(1)} °C`
    const series: BedSoakChartSeries[] = [{
      name: this.$t('app.bed_soak.label.bed').toString(),
      color: BedSoakColors.bed,
      format,
      data: this.temps
        .filter(sample => sample[1] != null)
        .map(sample => ({ value: [sample[0] / 60, sample[1] ?? 0] }))
    }]

    if (this.temps.some(sample => sample[2] != null)) {
      series.push({
        name: this.$t('app.bed_soak.label.chamber').toString(),
        color: BedSoakColors.chamber,
        format,
        data: this.temps
          .filter(sample => sample[2] != null)
          .map(sample => ({ value: [sample[0] / 60, sample[2] ?? 0] }))
      })
    }

    return series
  }

  get temperatureEvents (): BedSoakChartEvent[] {
    const events: BedSoakChartEvent[] = []

    if (this.run.heatersOn != null || this.elapsed != null) {
      events.push({ x: 0, label: this.$t('app.bed_soak.label.event_heaters_on').toString() })
    }
    if (this.milestones.bed != null) {
      events.push({ x: this.milestones.bed / 60, label: this.$t('app.bed_soak.label.event_bed').toString() })
    }
    if (this.milestones.chamber != null) {
      events.push({ x: this.milestones.chamber / 60, label: this.$t('app.bed_soak.label.event_chamber').toString() })
    }

    return events
  }

  get temperatureReferences (): BedSoakChartReference[] {
    const { bed, chamber } = this.run.settings

    return [
      { y: bed },
      ...(chamber ? [{ y: chamber }] : [])
    ]
  }

  get movementSeries (): BedSoakChartSeries[] {
    const format = (value: number) => `${Math.round(value)} µm`
    const point = (time: number, value: number | null, index: number) => ({
      value: [time / 60, (value ?? 0) * 1000] as [number, number],
      name: bedSoakMeshName(this, index)
    })

    return [
      {
        name: this.$t('app.bed_soak.label.height').toString(),
        color: BedSoakColors.height,
        markers: true,
        format,
        data: this.usedMeshes
          .filter(mesh => mesh.height != null)
          .map(mesh => point(mesh.time, mesh.height, mesh.index))
      },
      {
        name: this.$t('app.bed_soak.label.shape').toString(),
        color: BedSoakColors.shape,
        markers: true,
        format,
        data: this.usedMeshes
          .filter(mesh => mesh.shape != null)
          .map(mesh => point(mesh.time, mesh.shape, mesh.index))
      }
    ]
  }

  get movementEvents (): BedSoakChartEvent[] {
    const events: BedSoakChartEvent[] = this.run.jumps.map(jump => ({
      x: jump.time / 60,
      label: this.$t('app.bed_soak.label.event_jump', { mesh: jump.mesh }).toString()
    }))

    if (this.milestones.settled != null) {
      events.push({ x: this.milestones.settled / 60, label: this.$t('app.bed_soak.label.event_settled').toString() })
    }

    return events.sort((a, b) => a.x - b.x)
  }

  get speedSeries (): BedSoakChartSeries[] {
    const isDark = this.$typedState.config.uiSettings.theme.isDark

    return [{
      name: this.$t('app.bed_soak.label.speed').toString(),
      color: isDark ? '#c3c2b7' : '#5f5e58',
      markers: true,
      format: (value: number) => `${value.toFixed(1)} ${this.$t('app.bed_soak.label.um_per_min')}`,
      data: this.usedMeshes
        .filter(mesh => mesh.speed != null)
        .map(mesh => ({
          value: [mesh.time / 60, (mesh.speed ?? 0) * 1000] as [number, number],
          name: bedSoakMeshName(this, mesh.index)
        }))
    }]
  }

  get speedReferences (): BedSoakChartReference[] {
    return [{
      y: this.speedLimit,
      label: this.$t('app.bed_soak.label.limit').toString(),
      color: BedSoakColors.good
    }]
  }

  get speedBand () {
    return { from: 0, to: this.speedLimit, color: 'rgba(12,163,12,0.12)' }
  }
}
</script>
