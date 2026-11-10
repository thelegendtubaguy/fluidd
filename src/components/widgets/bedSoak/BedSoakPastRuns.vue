<template>
  <div class="bed-soak-past-runs">
    <v-card-text v-if="entries.length === 0">
      {{ $t('app.bed_soak.msg.no_runs') }}
    </v-card-text>

    <template v-else>
      <v-simple-table
        dense
        class="bed-soak-past-runs__table"
      >
        <thead>
          <tr>
            <th class="px-2" />
            <th>{{ $t('app.bed_soak.label.date') }}</th>
            <th class="text-right">
              {{ $t('app.bed_soak.label.bed') }}
            </th>
            <th class="text-right">
              {{ $t('app.bed_soak.label.chamber') }}
            </th>
            <th>{{ $t('app.bed_soak.label.mesh') }}</th>
            <th class="text-right">
              {{ $t('app.bed_soak.label.bed_at_temp') }}
            </th>
            <th>{{ $t('app.bed_soak.label.stopped_moving_short') }}</th>
            <th class="text-right">
              {{ $t('app.bed_soak.label.ready_short') }}
            </th>
            <th>{{ $t('app.bed_soak.label.problems') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="`run:${row.path}`"
            :class="{ 'bed-soak-past-runs__selected': row.color }"
          >
            <td class="px-2">
              <v-simple-checkbox
                :value="!!row.color"
                :disabled="!row.run || (!row.color && compare.length >= 3)"
                :ripple="false"
                @input="toggleCompare(row.path)"
              />
            </td>
            <td class="text-no-wrap">
              <span
                class="bed-soak-past-runs__swatch"
                :style="{ background: row.color || 'transparent' }"
              />
              {{ row.date }}
              <span
                v-if="row.note"
                class="secondary--text ms-1"
              >{{ row.note }}</span>
            </td>
            <td class="text-right text-no-wrap">
              {{ row.bed }} °C
            </td>
            <td class="text-right text-no-wrap">
              <span v-if="row.chamber">{{ row.chamber }} °C</span>
              <span
                v-else
                class="bed-soak-past-runs__muted"
              >{{ $t('app.bed_soak.label.off') }}</span>
            </td>
            <td class="text-no-wrap">
              {{ row.mesh }}
            </td>
            <td class="text-right text-no-wrap">
              {{ row.bedAt }}
            </td>
            <td class="text-no-wrap">
              <span
                v-if="row.settled"
                class="d-inline-flex align-center"
              >
                <v-icon
                  v-if="row.settled.icon"
                  small
                  :color="row.settled.icon === 'good' ? goodColor : warningColor"
                  class="me-1"
                >
                  {{ row.settled.icon === 'good' ? '$checkedCircle' : '$warning' }}
                </v-icon>
                {{ row.settled.text }}
              </span>
            </td>
            <td class="text-right text-no-wrap">
              {{ row.ready }}
            </td>
            <td class="text-no-wrap">
              <v-tooltip
                v-if="row.problems"
                bottom
              >
                <template #activator="{ on, attrs }">
                  <span
                    class="d-inline-flex align-center"
                    v-bind="attrs"
                    v-on="on"
                  >
                    <v-icon
                      small
                      :color="warningColor"
                      class="me-1"
                    >
                      $warning
                    </v-icon>
                    {{ row.problemCount }}
                  </span>
                </template>
                <span>{{ row.problems }}</span>
              </v-tooltip>
              <span
                v-else-if="row.run"
                class="bed-soak-past-runs__muted"
              >{{ $t('app.bed_soak.label.none') }}</span>
            </td>
            <td class="text-right text-no-wrap">
              <app-btn
                small
                icon
                color="primary"
                :disabled="!row.run"
                :title="$t('app.bed_soak.btn.open')"
                @click="$emit('open', row.path)"
              >
                <v-icon small>
                  $open
                </v-icon>
              </app-btn>
              <app-btn
                small
                icon
                :title="$t('app.bed_soak.btn.download')"
                @click="handleDownload(row.filename)"
              >
                <v-icon small>
                  $download
                </v-icon>
              </app-btn>
              <app-btn
                small
                icon
                :disabled="row.path === liveFile"
                :title="$t('app.bed_soak.btn.delete')"
                @click="handleDelete(row.filename)"
              >
                <v-icon small>
                  $delete
                </v-icon>
              </app-btn>
            </td>
          </tr>
        </tbody>
      </v-simple-table>

      <v-divider />

      <v-card-text
        v-if="compareRuns.length > 0"
        class="bed-soak-past-runs__compare"
        :class="{ 'bed-soak-past-runs__compare--stacked': !$vuetify.breakpoint.lgAndUp }"
      >
        <bed-soak-chart
          :title="$t('app.bed_soak.label.compare_height')"
          unit="µm"
          :series="heightSeries"
          :x-min="0"
          :x-max="xMax"
          group="bed-soak-compare"
          :time-label="timeLabel"
          :height="180"
        />
        <bed-soak-chart
          :title="$t('app.bed_soak.label.compare_chamber')"
          unit="°C"
          :series="chamberSeries"
          :x-min="0"
          :x-max="xMax"
          group="bed-soak-compare"
          :time-label="timeLabel"
          :height="180"
        />
      </v-card-text>
      <v-card-text
        v-else
        class="secondary--text"
      >
        {{ $t('app.bed_soak.msg.compare_hint') }}
      </v-card-text>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import FilesMixin from '@/mixins/files'
import { SocketActions } from '@/api/socketActions'
import BedSoakChart, { type BedSoakChartSeries } from './BedSoakChart.vue'
import {
  BED_SOAK_PATH,
  BedSoakColors,
  BedSoakRunColors,
  bedSoakMilestones,
  bedSoakProblemPoints,
  type BedSoakRun
} from '@/util/tltg-bed-soak'
import { bedSoakClock, bedSoakDuration } from './bed-soak-format'

export interface BedSoakRunEntry {
  /** Relative to the config root */
  path: string;
  filename: string;
  started: number;
  bed: number;
  chamber: number | null;
  run: BedSoakRun | null;
}

@Component({
  components: {
    BedSoakChart
  }
})
export default class BedSoakPastRuns extends Mixins(StateMixin, FilesMixin) {
  /** Newest first */
  @Prop({ type: Array, required: true })
  readonly entries!: BedSoakRunEntry[]

  /** The run in progress, which can't be deleted */
  @Prop({ type: String, default: '' })
  readonly liveFile!: string

  readonly goodColor = BedSoakColors.good
  readonly warningColor = BedSoakColors.warning

  compare: string[] = []
  compareChosen = false

  // Until runs are picked, compare the newest three
  @Watch('entries', { immediate: true })
  onEntries () {
    const paths = this.entries.map(entry => entry.path)

    this.compare = this.compare.filter(path => paths.includes(path))

    if (!this.compareChosen) {
      this.compare = this.entries
        .filter(entry => entry.run && entry.run.meshes.length > 1)
        .slice(0, 3)
        .map(entry => entry.path)
    }
  }

  toggleCompare (path: string) {
    this.compareChosen = true
    this.compare = this.compare.includes(path)
      ? this.compare.filter(item => item !== path)
      : [...this.compare, path].slice(-3)
  }

  colorFor (path: string): string | null {
    const index = this.compare.indexOf(path)

    return index >= 0 ? BedSoakRunColors[index] : null
  }

  get rows () {
    return this.entries.map(entry => {
      const run = entry.run
      const milestones = run ? bedSoakMilestones(run) : null
      const duration = (seconds: number | null | undefined) => seconds != null ? bedSoakDuration(this, seconds) : '—'
      const problems = run ? bedSoakProblemPoints(run).length : 0
      const jumps = run?.jumps.length ?? 0
      const state = run?.result?.state

      let settled: { text: string, icon?: 'good' | 'warning' } | null = null
      if (milestones?.settled != null) {
        settled = { text: duration(milestones.settled), icon: 'good' }
      } else if (state === 'finished') {
        settled = {
          text: this.$t('app.bed_soak.label.still_moving_at', { min: run?.settings.time_limit ?? '—' }).toString(),
          icon: 'warning'
        }
      } else if (run) {
        settled = { text: '—' }
      }

      let note = ''
      if (entry.path === this.liveFile) {
        note = this.$t('app.bed_soak.state.running').toString()
      } else if (run && !run.result) {
        note = this.$t('app.bed_soak.state.incomplete').toString()
      } else if (state === 'stopped' || state === 'failed') {
        note = this.$t(`app.bed_soak.state.${state}`).toString()
      }

      const probeCount = run?.meshes[0]?.matrix.length ?? run?.settings.probe_count

      return {
        path: entry.path,
        filename: entry.filename,
        run,
        color: this.colorFor(entry.path),
        date: this.$filters.formatDateTime((run?.settings.started || entry.started) * 1000),
        note,
        bed: run?.settings.bed ?? entry.bed,
        chamber: run ? run.settings.chamber : entry.chamber,
        mesh: probeCount
          ? `${run?.meshes[0]?.matrix[0].length ?? probeCount} × ${probeCount}`
          : '—',
        bedAt: run ? duration(milestones?.bed) : '…',
        settled,
        ready: run ? duration(milestones?.ready) : '',
        problemCount: problems + jumps,
        problems: [
          problems > 0 ? this.$tc('app.bed_soak.label.points_count', problems, { count: problems }).toString() : '',
          jumps > 0 ? this.$tc('app.bed_soak.label.jumps_count', jumps, { count: jumps }).toString() : ''
        ].filter(Boolean).join(' · ')
      }
    })
  }

  get compareRuns () {
    return this.compare
      .map(path => this.entries.find(entry => entry.path === path))
      .filter((entry): entry is BedSoakRunEntry & { run: BedSoakRun } => entry?.run != null)
      .map(entry => ({
        entry,
        run: entry.run,
        color: this.colorFor(entry.path) ?? BedSoakRunColors[0],
        name: entry.run.settings.chamber
          ? this.$t('app.bed_soak.label.targets_short', { bed: entry.run.settings.bed, chamber: entry.run.settings.chamber }).toString()
          : this.$t('app.bed_soak.label.targets_short_no_chamber', { bed: entry.run.settings.bed }).toString()
      }))
  }

  get xMax (): number {
    const times = this.compareRuns.flatMap(({ run }) => [
      ...run.meshes.map(mesh => mesh.time),
      run.temps.length > 0 ? run.temps[run.temps.length - 1][0] : 0
    ])

    return Math.max(10, Math.ceil(Math.max(0, ...times) / 60 / 5) * 5)
  }

  timeLabel (minutes: number) {
    return this.$t('app.bed_soak.label.after_heaters_on', { time: bedSoakClock(minutes * 60) }).toString()
  }

  get heightSeries (): BedSoakChartSeries[] {
    return this.compareRuns.map(({ run, color, name }) => ({
      name,
      color,
      format: (value: number) => `${Math.round(value)} µm`,
      data: [
        { value: [0, 0] as [number, number] },
        ...run.meshes
          .filter(mesh => mesh.used && mesh.index > 0 && mesh.height != null && mesh.time >= 0)
          .map(mesh => ({ value: [mesh.time / 60, (mesh.height ?? 0) * 1000] as [number, number] }))
      ]
    }))
  }

  get chamberSeries (): BedSoakChartSeries[] {
    return this.compareRuns.map(({ run, color, name }) => {
      let last = -Infinity

      return {
        name,
        color,
        format: (value: number) => `${value.toFixed(1)} °C`,
        // Every 30 s is plenty to compare runs
        data: run.temps
          .filter(sample => {
            if (sample[0] < 0 || sample[2] == null || sample[0] - last < 30) return false
            last = sample[0]
            return true
          })
          .map(sample => ({ value: [sample[0] / 60, sample[2] ?? 0] as [number, number] }))
      }
    })
  }

  handleDownload (filename: string) {
    this.downloadFile(filename, BED_SOAK_PATH)
  }

  async handleDelete (filename: string) {
    const result = await this.$confirm(
      this.$t('app.bed_soak.msg.confirm_delete', { name: filename }).toString(),
      { title: this.$tc('app.general.label.confirm'), color: 'card-heading', icon: '$error' }
    )

    if (result) {
      SocketActions.serverFilesDeleteFile(`${BED_SOAK_PATH}/${filename}`)
    }
  }
}
</script>

<style lang="scss" scoped>
  .bed-soak-past-runs__table :deep(th),
  .bed-soak-past-runs__table :deep(td) {
    padding: 0 8px !important;
  }

  .bed-soak-past-runs__table :deep(th:first-child),
  .bed-soak-past-runs__table :deep(td:first-child) {
    padding-left: 16px !important;
  }

  .bed-soak-past-runs__selected td {
    background: rgba(33, 150, 243, 0.07);
  }

  .bed-soak-past-runs__swatch {
    display: inline-block;
    width: 12px;
    height: 2px;
    margin-right: 6px;
    vertical-align: middle;
    border-radius: 1px;
  }

  .bed-soak-past-runs__muted {
    opacity: 0.55;
  }

  .bed-soak-past-runs__compare {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;

    &--stacked {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
