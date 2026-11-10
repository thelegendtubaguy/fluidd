<template>
  <div class="bed-soak-run">
    <div class="d-flex flex-wrap align-center bed-soak-run__line">
      <span
        v-for="(part, i) in runLine"
        :key="`line:${i}`"
        :class="{ 'secondary--text': i > 0 || !live }"
      >{{ part }}</span>
      <v-spacer />
      <app-btn
        v-if="file"
        small
        icon
        :title="$t('app.bed_soak.btn.download')"
        @click="handleDownload"
      >
        <v-icon small>
          $download
        </v-icon>
      </app-btn>
    </div>

    <v-progress-linear
      v-if="live && status && status.mesh_progress != null"
      :value="status.mesh_progress * 100"
      height="3"
      class="mt-1"
    />

    <v-row
      dense
      class="mt-2"
    >
      <v-col
        v-for="stat in stats"
        :key="`stat:${stat.id}`"
        cols="6"
        md="3"
      >
        <div class="body-2 secondary--text d-flex align-center">
          <v-icon
            v-if="stat.state === 'done'"
            small
            :color="goodColor"
            class="me-1"
          >
            $checkedCircle
          </v-icon>
          <v-icon
            v-else-if="stat.state === 'warning'"
            small
            :color="warningColor"
            class="me-1"
          >
            $warning
          </v-icon>
          <v-progress-circular
            v-else-if="stat.state === 'active'"
            indeterminate
            size="12"
            width="2"
            color="primary"
            class="me-2"
          />
          {{ stat.label }}
        </div>
        <div>
          <span class="font-weight-medium">{{ stat.value }}</span>
          <span
            v-if="stat.detail"
            class="secondary--text ms-1"
          >{{ stat.detail }}</span>
        </div>
      </v-col>
    </v-row>

    <template v-if="!live && run">
      <div
        v-if="summary"
        class="secondary--text mt-2"
      >
        {{ summary }}
      </div>

      <v-alert
        v-if="warning"
        type="warning"
        text
        dense
        class="mt-3 mb-0"
      >
        {{ warning }}
      </v-alert>

      <v-alert
        v-if="endNote"
        type="info"
        text
        dense
        class="mt-3 mb-0"
      >
        {{ endNote }}
      </v-alert>
    </template>

    <div
      v-if="run && run.meshes.length > 0"
      class="bed-soak-split mt-3"
      :class="{ 'bed-soak-split--stacked': !$vuetify.breakpoint.lgAndUp }"
    >
      <bed-soak-run-charts
        :run="run"
        :temps="temps"
        :milestones="milestones"
        :elapsed="live && status && status.elapsed != null ? status.elapsed : undefined"
      />
      <bed-soak-heatmap :run="run" />
    </div>
    <div
      v-else
      class="secondary--text mt-3"
    >
      {{ $t('app.bed_soak.msg.charts_after_cold') }}
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import FilesMixin from '@/mixins/files'
import BedSoakRunCharts from './BedSoakRunCharts.vue'
import BedSoakHeatmap from './BedSoakHeatmap.vue'
import {
  BED_SOAK_ROOT,
  BED_SOAK_SETTLED_MESHES,
  BedSoakColors,
  bedSoakMeshesUnderLimit,
  bedSoakMilestones,
  bedSoakRepeatedProblemPoints,
  bedSoakStartTemps,
  type BedSoakRun,
  type BedSoakTemp
} from '@/util/tltg-bed-soak'
import { bedSoakClock, bedSoakDuration, bedSoakPointName } from './bed-soak-format'

interface Stat {
  id: string;
  label: string;
  value: string;
  detail?: string;
  state: 'done' | 'active' | 'warning' | 'none';
}

@Component({
  components: {
    BedSoakRunCharts,
    BedSoakHeatmap
  }
})
export default class BedSoakRunView extends Mixins(StateMixin, FilesMixin) {
  @Prop({ type: Object })
  readonly run?: BedSoakRun | null

  /** The live status, for the run in progress */
  @Prop({ type: Object })
  readonly status?: Klipper.TltgBedSoakState | null

  @Prop({ type: Boolean })
  readonly live?: boolean

  /** Temperatures sampled since the run file's last mesh */
  @Prop({ type: Array, default: () => [] })
  readonly liveTemps!: BedSoakTemp[]

  /** The run file, relative to the config root */
  @Prop({ type: String })
  readonly file?: string

  readonly goodColor = BedSoakColors.good
  readonly warningColor = BedSoakColors.warning

  duration (seconds: number) {
    return bedSoakDuration(this, seconds)
  }

  get settings () {
    const settings = this.run?.settings ?? this.status?.settings

    return {
      started: this.run?.settings.started ?? this.status?.started ?? null,
      bed: settings?.bed ?? 0,
      chamber: settings?.chamber ?? null,
      probe_count: settings?.probe_count ?? 5,
      time_limit: settings?.time_limit ?? null,
      keep_heating: settings?.keep_heating ?? false
    }
  }

  get speedLimit (): number {
    return this.status?.limits?.speed ?? this.run?.settings.limits.speed ?? 0.002
  }

  get milestones (): Klipper.TltgBedSoakMilestones {
    if (this.live && this.status) return this.status.milestones

    return this.run
      ? bedSoakMilestones(this.run)
      : { bed: null, chamber: null, chamber_max: null, settled: null, ready: null }
  }

  get temps (): BedSoakTemp[] {
    const temps = this.run?.temps ?? []
    const last = temps.length > 0 ? temps[temps.length - 1][0] : -Infinity

    return this.live
      ? [...temps, ...this.liveTemps.filter(sample => sample[0] > last)]
      : temps
  }

  get current () {
    const printer = this.$typedState.printer.printer
    const chamber = printer['heater_generic chamber'] ?? printer['temperature_sensor chamber']

    return {
      bed: printer.heater_bed?.temperature as number | undefined,
      chamber: chamber?.temperature as number | undefined
    }
  }

  get stepText (): string {
    const status = this.status

    if (!status) return ''
    if (status.stop_requested) return this.$t('app.bed_soak.step.stopping').toString()

    switch (status.step) {
      case 'nozzle':
        return this.$t('app.bed_soak.step.nozzle', { temp: status.settings?.nozzle ?? '' }).toString()
      case 'mesh':
        return this.$t('app.bed_soak.step.mesh', { n: status.meshes }).toString()
      case '':
        return this.$t('app.bed_soak.state.running').toString()
      default:
        return this.$t(`app.bed_soak.step.${status.step}`).toString()
    }
  }

  // What the test is doing, or which run this is
  get runLine (): string[] {
    const { started, bed, chamber, probe_count: probeCount } = this.settings
    const targets = chamber
      ? this.$t('app.bed_soak.label.targets', { bed, chamber }).toString()
      : this.$t('app.bed_soak.label.targets_no_chamber', { bed }).toString()
    const mesh = `${probeCount} × ${probeCount}`

    if (this.live && this.status) {
      return [
        this.stepText,
        ...(this.status.elapsed != null
          ? [this.$t('app.bed_soak.label.since_heaters_on', { time: bedSoakClock(this.status.elapsed) }).toString()]
          : []),
        targets,
        mesh
      ].map((part, i) => i > 0 ? ` · ${part}` : part)
    }

    const state = this.run?.result?.state
    const parts = [
      ...(started ? [this.$filters.formatDateTime(started * 1000)] : []),
      targets,
      mesh,
      this.$t(`app.bed_soak.state.${state ?? 'incomplete'}`).toString()
    ]

    return parts.map((part, i) => i > 0 ? ` · ${part}` : part)
  }

  get stats (): Stat[] {
    const milestones = this.milestones
    const { bed, chamber } = this.settings
    const live = !!this.live && !!this.status
    const heating = live ? this.status?.heaters_on != null : true
    const finished = this.run?.result?.state === 'finished'
    const start = !live && this.run ? bedSoakStartTemps(this.run) : null
    const pending = (value: number | undefined): Pick<Stat, 'value' | 'detail' | 'state'> => (
      live && heating
        ? { value: this.$t('app.bed_soak.label.heating').toString(), detail: value != null ? `${value.toFixed(1)} °C` : undefined, state: 'active' }
        : { value: '—', state: 'none' }
    )
    const from = (value: number | null | undefined) => value != null
      ? this.$t('app.bed_soak.label.from', { temp: value.toFixed(1) }).toString()
      : undefined

    const stats: Stat[] = [{
      id: 'bed',
      label: this.$t('app.bed_soak.label.bed_at', { temp: bed }).toString(),
      ...(milestones.bed != null
        ? { value: this.duration(milestones.bed), detail: from(start?.[1]), state: 'done' }
        : pending(this.current.bed))
    }]

    if (!chamber) {
      stats.push({
        id: 'chamber',
        label: this.$t('app.bed_soak.label.chamber').toString(),
        value: this.$t('app.bed_soak.label.off_value').toString(),
        state: 'none'
      })
    } else if (milestones.chamber != null) {
      stats.push({
        id: 'chamber',
        label: this.$t('app.bed_soak.label.chamber_at', { temp: chamber }).toString(),
        value: this.duration(milestones.chamber),
        detail: from(start?.[2]),
        state: 'done'
      })
    } else if (milestones.chamber_max != null) {
      stats.push({
        id: 'chamber',
        label: this.$t('app.bed_soak.label.chamber_at', { temp: chamber }).toString(),
        value: this.$t('app.bed_soak.label.stopped_warming_at', { temp: milestones.chamber_max.toFixed(1) }).toString(),
        state: 'none'
      })
    } else {
      stats.push({
        id: 'chamber',
        label: this.$t('app.bed_soak.label.chamber_at', { temp: chamber }).toString(),
        ...pending(this.current.chamber)
      })
    }

    if (milestones.settled != null) {
      stats.push({ id: 'settled', label: this.$t('app.bed_soak.label.stopped_moving').toString(), value: this.duration(milestones.settled), state: 'done' })
    } else if (live && milestones.bed != null) {
      const under = this.run ? bedSoakMeshesUnderLimit(this.run, milestones.bed, this.speedLimit) : 0

      stats.push({
        id: 'settled',
        label: this.$t('app.bed_soak.label.stopped_moving').toString(),
        value: this.$t('app.bed_soak.label.settling').toString(),
        detail: this.$t('app.bed_soak.label.meshes_under', { count: under, total: BED_SOAK_SETTLED_MESHES }).toString(),
        state: 'active'
      })
    } else if (finished) {
      stats.push({
        id: 'settled',
        label: this.$t('app.bed_soak.label.stopped_moving').toString(),
        value: this.$t('app.bed_soak.label.still_moving_after', { min: this.settings.time_limit ?? '—' }).toString(),
        state: 'warning'
      })
    } else {
      stats.push({ id: 'settled', label: this.$t('app.bed_soak.label.stopped_moving').toString(), value: '—', state: 'none' })
    }

    stats.push({
      id: 'ready',
      label: this.$t('app.bed_soak.label.ready').toString(),
      value: milestones.ready != null ? this.duration(milestones.ready) : '—',
      state: milestones.ready != null ? 'done' : 'none'
    })

    return stats
  }

  get summary (): string | null {
    const run = this.run

    if (!run) return null

    const used = run.meshes.filter(mesh => mesh.used)
    const last = used[used.length - 1]
    const parts: string[] = []

    if (last && last.index > 0 && last.height != null && last.shape != null) {
      parts.push(this.$t('app.bed_soak.msg.moved', {
        height: `${last.height >= 0 ? '+' : '−'}${Math.abs(last.height).toFixed(3)}`,
        shape: last.shape.toFixed(3)
      }).toString())
    }

    const lastMesh = run.meshes[run.meshes.length - 1]
    const end = run.result?.ended != null && run.heatersOn != null
      ? run.result.ended - run.heatersOn
      : lastMesh?.end ?? lastMesh?.time

    if (end != null && end > 0) {
      parts.push(this.$tc('app.bed_soak.msg.meshes_over', run.meshes.length, {
        count: run.meshes.length,
        duration: this.duration(end)
      }).toString())
    }

    if (run.result) {
      parts.push(run.result.state === 'finished' && run.settings.keep_heating
        ? this.$t('app.bed_soak.msg.kept_heating').toString()
        : this.$t('app.bed_soak.msg.heaters_off').toString())
    }

    return parts.length > 0 ? parts.join(' · ') : null
  }

  get endNote (): string | null {
    const result = this.run?.result

    if (!result) return this.$t('app.bed_soak.msg.incomplete').toString()
    if (result.state === 'finished') return null

    return this.$t(`app.bed_soak.msg.ended_${result.state}`, { reason: result.reason }).toString().trim()
  }

  get warning (): string | null {
    const run = this.run

    if (!run?.result?.warning) return null

    const points = bedSoakRepeatedProblemPoints(run)
    const names = points.slice(0, 3).map(point => bedSoakPointName(this, point))
    const pointList = names.join(', ') + (points.length > 3 ? ` +${points.length - 3}` : '')
    const sentences: string[] = []

    if (points.length > 0) {
      sentences.push(this.$tc('app.bed_soak.msg.warning_points', points.length, { points: pointList }).toString())
    }

    if (run.jumps.length > 0) {
      sentences.push(this.$tc('app.bed_soak.msg.warning_jumps', run.jumps.length, {
        meshes: run.jumps.map(jump => jump.mesh).join(', ')
      }).toString())
    }

    sentences.push(this.$t('app.bed_soak.msg.warning_check').toString())

    return sentences.join(' ')
  }

  handleDownload () {
    if (!this.file) return

    const parts = this.file.split('/')
    const filename = parts.pop() ?? ''

    this.downloadFile(filename, [BED_SOAK_ROOT, ...parts].join('/'))
  }
}
</script>

<style lang="scss" scoped>
  .bed-soak-run__line {
    min-height: 28px;
    white-space: pre-wrap;
  }

  .bed-soak-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 24px;
  }

  .bed-soak-split--stacked {
    grid-template-columns: minmax(0, 1fr);
  }
</style>
