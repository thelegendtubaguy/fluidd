<template>
  <div class="bed-soak-run">
    <!-- Live: milestones and what the test is doing -->
    <template v-if="live && status">
      <div class="bed-soak-milestones">
        <div
          v-for="milestone in liveMilestones"
          :key="`milestone:${milestone.id}`"
          class="bed-soak-milestone"
          :class="`bed-soak-milestone--${milestone.state}`"
        >
          <div class="bed-soak-milestone__label">
            <v-icon
              v-if="milestone.state === 'done'"
              small
              :color="goodColor"
              class="me-1"
            >
              $checkedCircle
            </v-icon>
            <v-progress-circular
              v-else-if="milestone.state === 'active'"
              indeterminate
              size="12"
              width="2"
              color="primary"
              class="me-1"
            />
            <v-icon
              v-else
              small
              class="me-1 bed-soak-muted"
            >
              $blankCircle
            </v-icon>
            {{ milestone.label }}
          </div>
          <div class="bed-soak-milestone__value">
            {{ milestone.value }}
          </div>
          <div class="bed-soak-milestone__sub">
            {{ milestone.sub }}
          </div>
        </div>
      </div>

      <div class="bed-soak-live">
        <span v-if="status.elapsed != null">
          {{ $t('app.bed_soak.label.since_heaters_on') }} <b>{{ clock(status.elapsed) }}</b>
        </span>
        <span>
          <i
            class="bed-soak-live__key"
            :style="{ background: colors.bed }"
          />{{ $t('app.bed_soak.label.bed') }}
          <b>{{ formatTemp(current.bed) }}</b> / {{ settings.bed }} °C
        </span>
        <span v-if="current.chamber != null">
          <i
            class="bed-soak-live__key"
            :style="{ background: colors.chamber }"
          />{{ $t('app.bed_soak.label.chamber') }}
          <b>{{ formatTemp(current.chamber) }}</b><template v-if="settings.chamber"> / {{ settings.chamber }}</template> °C
        </span>
        <span v-if="current.nozzle != null">
          {{ $t('app.bed_soak.label.nozzle') }} <b>{{ formatTemp(current.nozzle) }}</b> °C
        </span>
        <span class="bed-soak-live__step">
          <span>{{ stepText }}</span>
          <v-progress-linear
            v-if="status.mesh_progress != null"
            :value="status.mesh_progress * 100"
            height="4"
            rounded
            class="ms-3"
          />
        </span>
      </div>
    </template>

    <!-- Ended: the answer first -->
    <template v-else-if="run">
      <div class="bed-soak-figures">
        <div
          v-for="figure in figures"
          :key="`figure:${figure.id}`"
          class="bed-soak-figure"
          :class="{ 'bed-soak-figure--good': figure.good }"
        >
          <div class="bed-soak-figure__label">
            <v-icon
              v-if="figure.good"
              small
              :color="goodColor"
              class="me-1"
            >
              $checkedCircle
            </v-icon>
            <v-icon
              v-else-if="figure.warning"
              small
              :color="warningColor"
              class="me-1"
            >
              $warning
            </v-icon>
            {{ figure.label }}
          </div>
          <div class="bed-soak-figure__value">
            {{ figure.value }}
          </div>
          <div class="bed-soak-figure__sub">
            {{ figure.sub }}
          </div>
        </div>
      </div>

      <div class="bed-soak-summary">
        <span
          v-for="(sentence, i) in summary"
          :key="`summary:${i}`"
          v-safe-html="sentence"
          class="me-1"
        />
      </div>

      <div
        v-if="endNote"
        class="bed-soak-summary"
      >
        {{ endNote }}
      </div>

      <div
        v-if="warning"
        class="bed-soak-warning"
      >
        <v-icon
          small
          :color="warningColor"
          class="me-2 mt-1"
        >
          $warning
        </v-icon>
        <span>
          {{ warning.title }}
          <small>{{ warning.detail }}</small>
        </span>
      </div>
    </template>

    <div
      v-if="run && run.meshes.length > 0"
      class="bed-soak-split"
      :class="{ 'bed-soak-split--stacked': !$vuetify.breakpoint.lgAndUp }"
    >
      <bed-soak-run-charts
        :run="run"
        :temps="temps"
        :milestones="milestones"
        :elapsed="live && status && status.elapsed != null ? status.elapsed : undefined"
      />
      <bed-soak-heatmap :run="run">
        <template #actions>
          <app-btn
            v-if="file"
            small
            class="me-2 mb-2"
            @click="handleDownload"
          >
            {{ $t('app.bed_soak.btn.download') }}
          </app-btn>
        </template>
      </bed-soak-heatmap>
    </div>
    <div
      v-else
      class="bed-soak-placeholder"
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
  type BedSoakSettings,
  type BedSoakTemp
} from '@/util/tltg-bed-soak'
import { bedSoakClock, bedSoakDuration, bedSoakMeshName, bedSoakPointName } from './bed-soak-format'

type MilestoneState = 'done' | 'active' | 'wait'

interface Milestone {
  id: string;
  label: string;
  value: string;
  sub: string;
  state: MilestoneState;
}

interface Figure {
  id: string;
  label: string;
  value: string;
  sub: string;
  good?: boolean;
  warning?: boolean;
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

  readonly colors = BedSoakColors
  readonly goodColor = BedSoakColors.good
  readonly warningColor = BedSoakColors.warning

  clock (seconds: number) {
    return bedSoakClock(seconds)
  }

  duration (seconds: number) {
    return bedSoakDuration(this, seconds)
  }

  formatTemp (value: number | null | undefined) {
    return value != null ? value.toFixed(1) : '—'
  }

  get settings (): Pick<BedSoakSettings, 'bed' | 'chamber' | 'probe_count' | 'keep_heating' | 'limits'> {
    if (this.run) return this.run.settings

    const settings = this.status?.settings

    return {
      bed: settings?.bed ?? 0,
      chamber: settings?.chamber ?? null,
      probe_count: settings?.probe_count ?? 5,
      keep_heating: settings?.keep_heating ?? false,
      limits: this.status?.limits ?? {}
    }
  }

  get speedLimit (): number {
    return this.status?.limits?.speed ?? this.settings.limits.speed ?? 0.002
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
      chamber: chamber?.temperature as number | undefined,
      nozzle: printer.extruder?.temperature as number | undefined
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
        return ''
      default:
        return this.$t(`app.bed_soak.step.${status.step}`).toString()
    }
  }

  get liveMilestones (): Milestone[] {
    const status = this.status

    if (!status) return []

    const milestones = status.milestones
    const heating = status.heaters_on != null
    const after = this.$t('app.bed_soak.label.after_heaters_on_short').toString()
    const { bed, chamber } = this.settings
    const waiting = this.$t('app.bed_soak.label.waiting').toString()
    const now = (value: number | undefined) => value != null
      ? this.$t('app.bed_soak.label.now', { temp: value.toFixed(1) }).toString()
      : ''

    const items: Milestone[] = []

    items.push(milestones.bed != null
      ? { id: 'bed', label: this.$t('app.bed_soak.label.bed_at', { temp: bed }).toString(), value: this.duration(milestones.bed), sub: after, state: 'done' }
      : heating
        ? { id: 'bed', label: this.$t('app.bed_soak.label.bed_at', { temp: bed }).toString(), value: this.$t('app.bed_soak.label.heating').toString(), sub: now(this.current.bed), state: 'active' }
        : { id: 'bed', label: this.$t('app.bed_soak.label.bed_at', { temp: bed }).toString(), value: waiting, sub: this.$t('app.bed_soak.label.heats_after_cold').toString(), state: 'wait' })

    if (!chamber) {
      items.push({ id: 'chamber', label: this.$t('app.bed_soak.label.chamber_temperature').toString(), value: this.$t('app.bed_soak.label.not_heated').toString(), sub: now(this.current.chamber), state: 'wait' })
    } else if (milestones.chamber != null) {
      items.push({ id: 'chamber', label: this.$t('app.bed_soak.label.chamber_at', { temp: chamber }).toString(), value: this.duration(milestones.chamber), sub: after, state: 'done' })
    } else if (milestones.chamber_max != null) {
      items.push({ id: 'chamber', label: this.$t('app.bed_soak.label.chamber_at', { temp: chamber }).toString(), value: this.$t('app.bed_soak.label.stopped_warming').toString(), sub: this.$t('app.bed_soak.label.highest', { temp: milestones.chamber_max.toFixed(1) }).toString(), state: 'done' })
    } else {
      items.push({ id: 'chamber', label: this.$t('app.bed_soak.label.chamber_at', { temp: chamber }).toString(), value: heating ? this.$t('app.bed_soak.label.heating').toString() : waiting, sub: heating ? now(this.current.chamber) : this.$t('app.bed_soak.label.heats_after_cold').toString(), state: heating ? 'active' : 'wait' })
    }

    const under = this.run ? bedSoakMeshesUnderLimit(this.run, milestones.bed, this.speedLimit) : 0

    items.push(milestones.settled != null
      ? { id: 'settled', label: this.$t('app.bed_soak.label.stopped_moving').toString(), value: this.duration(milestones.settled), sub: after, state: 'done' }
      : milestones.bed != null
        ? {
            id: 'settled',
            label: this.$t('app.bed_soak.label.stopped_moving').toString(),
            value: this.$t('app.bed_soak.label.settling').toString(),
            sub: this.$t('app.bed_soak.label.meshes_under', { count: under, total: BED_SOAK_SETTLED_MESHES, limit: this.formatLimit() }).toString(),
            state: 'active'
          }
        : { id: 'settled', label: this.$t('app.bed_soak.label.stopped_moving').toString(), value: waiting, sub: this.$t('app.bed_soak.label.checked_at_temp').toString(), state: 'wait' })

    items.push(milestones.ready != null
      ? { id: 'ready', label: this.$t('app.bed_soak.label.ready').toString(), value: this.duration(milestones.ready), sub: after, state: 'done' }
      : { id: 'ready', label: this.$t('app.bed_soak.label.ready').toString(), value: waiting, sub: this.$t('app.bed_soak.label.ready_when').toString(), state: milestones.bed != null ? 'active' : 'wait' })

    return items
  }

  formatLimit () {
    return `${+(this.speedLimit * 1000).toFixed(1)}`
  }

  get startTemps () {
    return this.run ? bedSoakStartTemps(this.run) : null
  }

  get figures (): Figure[] {
    const run = this.run

    if (!run) return []

    const { bed, chamber } = run.settings
    const milestones = this.milestones
    const start = this.startTemps
    const from = (value: number | null | undefined) => value != null
      ? this.$t('app.bed_soak.label.from', { temp: value.toFixed(1) }).toString()
      : ''

    const figures: Figure[] = [{
      id: 'bed',
      label: this.$t('app.bed_soak.label.bed_reached', { temp: bed }).toString(),
      value: milestones.bed != null ? this.duration(milestones.bed) : '—',
      sub: milestones.bed != null ? from(start?.[1]) : this.$t('app.bed_soak.label.not_reached').toString()
    }]

    if (chamber) {
      figures.push(milestones.chamber == null && milestones.chamber_max != null
        ? {
            id: 'chamber',
            label: this.$t('app.bed_soak.label.chamber_stopped_warming').toString(),
            value: `${milestones.chamber_max.toFixed(1)} °C`,
            sub: this.$t('app.bed_soak.label.chamber_below', { temp: chamber }).toString()
          }
        : {
            id: 'chamber',
            label: this.$t('app.bed_soak.label.chamber_reached', { temp: chamber }).toString(),
            value: milestones.chamber != null ? this.duration(milestones.chamber) : '—',
            sub: milestones.chamber != null ? from(start?.[2]) : this.$t('app.bed_soak.label.not_reached').toString()
          })
    }

    figures.push(milestones.settled != null
      ? {
          id: 'settled',
          label: this.$t('app.bed_soak.label.stopped_moving_after').toString(),
          value: this.duration(milestones.settled),
          sub: this.$t('app.bed_soak.label.settled_rule', { limit: this.formatLimit(), count: BED_SOAK_SETTLED_MESHES }).toString(),
          good: true
        }
      : {
          id: 'settled',
          label: this.$t('app.bed_soak.label.stopped_moving').toString(),
          value: run.result?.state === 'finished'
            ? this.$t('app.bed_soak.label.still_moving_value').toString()
            : '—',
          sub: run.result?.state === 'finished'
            ? this.$t('app.bed_soak.label.at_end').toString()
            : this.$t('app.bed_soak.label.not_measured').toString(),
          warning: run.result?.state === 'finished'
        })

    if (chamber) {
      figures.push({
        id: 'ready',
        label: this.$t('app.bed_soak.label.ready_after').toString(),
        value: milestones.ready != null ? this.duration(milestones.ready) : '—',
        sub: this.$t('app.bed_soak.label.ready_when').toString()
      })
    }

    return figures
  }

  get summary (): string[] {
    const run = this.run

    if (!run) return []

    const used = run.meshes.filter(mesh => mesh.used)
    const last = used[used.length - 1]
    const sentences = [this.$t('app.bed_soak.msg.times_from_heaters_on').toString()]

    if (last && last.index > 0 && last.height != null && last.shape != null) {
      sentences.push(this.$t('app.bed_soak.msg.moved', {
        height: `<b>${last.height.toFixed(3)} mm</b>`,
        shape: `<b>${last.shape.toFixed(3)} mm</b>`
      }).toString())
    }

    const lastMesh = run.meshes[run.meshes.length - 1]
    const end = run.result?.ended != null && run.heatersOn != null
      ? run.result.ended - run.heatersOn
      : lastMesh?.end ?? lastMesh?.time

    if (end != null && end > 0) {
      sentences.push(this.$tc('app.bed_soak.msg.meshes_over', run.meshes.length, {
        count: run.meshes.length,
        duration: this.duration(end)
      }).toString())
    }

    if (run.result) {
      sentences.push(run.result.state === 'finished' && run.settings.keep_heating
        ? this.$t('app.bed_soak.msg.kept_heating').toString()
        : this.$t('app.bed_soak.msg.heaters_off').toString())
    }

    return sentences
  }

  get endNote (): string | null {
    const result = this.run?.result

    if (!result) return this.$t('app.bed_soak.msg.incomplete').toString()
    if (result.state === 'finished') return null

    const reason = result.reason || this.$t(`app.bed_soak.state.${result.state}`).toString()

    return this.$t(`app.bed_soak.msg.ended_${result.state}`, { reason }).toString()
  }

  get warning (): { title: string, detail: string } | null {
    const run = this.run

    if (!run?.result?.warning) return null

    const points = bedSoakRepeatedProblemPoints(run)
    const names = points.slice(0, 3).map(point => bedSoakPointName(this, point))
    const pointList = names.join(', ') + (points.length > 3 ? ` +${points.length - 3}` : '')
    const title: string[] = []
    const detail: string[] = []

    if (points.length > 0) {
      title.push(this.$tc('app.bed_soak.msg.warning_points', points.length, { points: pointList }).toString())
    }

    for (const jump of run.jumps) {
      title.push(this.$t('app.bed_soak.msg.warning_jump', {
        size: Math.round(jump.size * 1000),
        n: jump.mesh
      }).toString())
    }

    if (run.jumps.length > 0) {
      detail.push(this.$tc('app.bed_soak.msg.warning_jump_detail', run.jumps.length, {
        meshes: run.jumps.map(jump => bedSoakMeshName(this, jump.mesh)).join(', ')
      }).toString())
    }

    detail.push(points.length > 0
      ? this.$t('app.bed_soak.msg.warning_check_points', { points: pointList }).toString()
      : this.$t('app.bed_soak.msg.warning_check_plate').toString())

    return {
      title: title.join(' '),
      detail: detail.join(' ')
    }
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
  .bed-soak-muted {
    opacity: 0.5;
  }

  .bed-soak-milestones,
  .bed-soak-figures {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .bed-soak-milestone,
  .bed-soak-figure {
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 4px;
    padding: 10px 12px;
  }

  .bed-soak-milestone--done,
  .bed-soak-figure--good {
    border-color: rgba(12, 163, 12, 0.5);
  }

  .bed-soak-milestone__label,
  .bed-soak-figure__label {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    opacity: 0.85;
  }

  .bed-soak-milestone__value {
    font-size: clamp(1.125rem, 2vw, 1.375rem);
    font-weight: 600;
    margin-top: 2px;
  }

  .bed-soak-milestone--wait .bed-soak-milestone__value {
    font-size: 0.9375rem;
    font-weight: 400;
    opacity: 0.6;
    margin-top: 6px;
  }

  .bed-soak-figure__value {
    font-size: clamp(1.25rem, 2.4vw, 1.75rem);
    font-weight: 600;
    line-height: 1.2;
    margin-top: 2px;
  }

  .bed-soak-milestone__sub,
  .bed-soak-figure__sub {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .bed-soak-live {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 22px;
    font-size: 0.8125rem;
    margin-bottom: 12px;

    b {
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
  }

  .bed-soak-live__key {
    display: inline-block;
    width: 12px;
    height: 2px;
    margin-right: 6px;
    vertical-align: middle;
    border-radius: 1px;
  }

  .bed-soak-live__step {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 220px;
  }

  .bed-soak-summary {
    font-size: 0.8125rem;
    opacity: 0.85;
    margin: 4px 0 12px;
  }

  .bed-soak-warning {
    display: flex;
    align-items: flex-start;
    padding: 10px 12px;
    margin: 0 0 14px;
    border-radius: 4px;
    font-size: 0.8125rem;
    background: rgba(250, 178, 25, 0.08);
    border: 1px solid rgba(250, 178, 25, 0.35);

    small {
      display: block;
      font-size: 0.75rem;
      opacity: 0.8;
      margin-top: 2px;
    }
  }

  .bed-soak-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 270px;
    gap: 18px;
  }

  .bed-soak-split--stacked {
    grid-template-columns: minmax(0, 1fr);
  }

  .bed-soak-placeholder {
    padding: 24px;
    text-align: center;
    font-size: 0.8125rem;
    opacity: 0.6;
    border: 1px dashed rgba(128, 128, 128, 0.4);
    border-radius: 4px;
  }
</style>
