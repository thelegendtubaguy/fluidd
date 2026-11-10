<template>
  <div class="bed-soak-setup">
    <p class="bed-soak-setup__lead">
      {{ $t('app.bed_soak.msg.lead') }}
    </p>

    <div
      v-if="presets.length > 0"
      class="bed-soak-setup__presets"
    >
      <span class="bed-soak-setup__label me-1">{{ $t('app.bed_soak.label.presets') }}</span>
      <v-chip
        v-for="preset in presets"
        :key="`preset:${preset.id}`"
        small
        :outlined="!preset.selected"
        :color="preset.selected ? 'primary' : undefined"
        @click="applyPreset(preset)"
      >
        {{ preset.name }}
        <small class="ms-2 bed-soak-setup__preset-values">
          {{ preset.bed }} · {{ preset.chamber || $t('app.bed_soak.label.off') }}
        </small>
      </v-chip>
    </div>

    <v-form
      ref="form"
      v-model="valid"
      @submit.prevent="handleStart"
    >
      <v-row dense>
        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-text-field
            v-model.number="bed"
            :label="$t('app.bed_soak.label.bed_temperature')"
            :hint="$t('app.bed_soak.hint.bed')"
            persistent-hint
            suffix="°C"
            type="number"
            filled
            dense
            :rules="bedRules"
          />
        </v-col>
        <v-col
          v-if="chamberAvailable"
          cols="12"
          sm="6"
          md="4"
        >
          <v-text-field
            v-model.number="chamber"
            :label="$t('app.bed_soak.label.chamber_temperature')"
            :hint="$t('app.bed_soak.hint.chamber')"
            persistent-hint
            suffix="°C"
            type="number"
            filled
            dense
            :rules="chamberRules"
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <div class="bed-soak-setup__label mb-1">
            {{ $t('app.bed_soak.label.mesh') }}
          </div>
          <v-btn-toggle
            v-model="probeCount"
            mandatory
            dense
            color="primary"
            class="bed-soak-setup__toggle"
          >
            <v-btn
              v-for="count in probeCounts"
              :key="`probe:${count}`"
              small
              :value="count"
            >
              {{ count }} × {{ count }}
            </v-btn>
          </v-btn-toggle>
          <div class="bed-soak-setup__hint">
            {{ $t('app.bed_soak.hint.mesh') }}
          </div>
        </v-col>
        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <div class="bed-soak-setup__label">
            {{ $t('app.bed_soak.label.stop_when') }}
          </div>
          <v-switch
            v-model="stopWhenSettled"
            :label="$t('app.bed_soak.label.stops_moving')"
            hide-details
            class="mt-1"
          />
          <div class="bed-soak-setup__hint">
            {{ $t('app.bed_soak.hint.stop_when', { limit: speedLimit, count: settledMeshes }) }}
          </div>
        </v-col>
        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <v-text-field
            v-model.number="timeLimit"
            :label="$t('app.bed_soak.label.time_limit')"
            :hint="$t('app.bed_soak.hint.time_limit')"
            persistent-hint
            :suffix="$t('app.bed_soak.label.min')"
            type="number"
            filled
            dense
            :rules="timeLimitRules"
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
          md="4"
        >
          <div class="bed-soak-setup__label mb-1">
            {{ $t('app.bed_soak.label.after_test') }}
          </div>
          <v-btn-toggle
            v-model="keepHeating"
            mandatory
            dense
            color="primary"
            class="bed-soak-setup__toggle"
          >
            <v-btn
              small
              :value="false"
            >
              {{ $t('app.bed_soak.label.heaters_off') }}
            </v-btn>
            <v-btn
              small
              :value="true"
            >
              {{ $t('app.bed_soak.label.keep_heating') }}
            </v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <div class="bed-soak-setup__checks">
        <div class="bed-soak-setup__checks-title">
          {{ $t('app.bed_soak.label.before_start') }}
        </div>
        <div
          v-for="check in checks"
          :key="`check:${check.id}`"
          class="bed-soak-setup__check"
        >
          <v-icon
            small
            :color="check.ok ? goodColor : warningColor"
            class="me-2"
          >
            {{ check.ok ? '$checkedCircle' : '$warning' }}
          </v-icon>
          <span>
            {{ check.label }}
            <small>{{ check.sub }}</small>
          </span>
        </div>
      </div>

      <div class="d-flex flex-wrap align-center mt-4">
        <app-btn
          type="submit"
          color="primary"
          class="me-3 my-1"
          :disabled="!canStart"
          :loading="hasWait($waits.onBedSoakStart)"
        >
          <v-icon
            small
            left
          >
            $play
          </v-icon>
          {{ $t('app.bed_soak.btn.start') }}
        </app-btn>
        <span class="bed-soak-setup__hint">{{ $t('app.bed_soak.msg.start_note') }}</span>
      </div>
    </v-form>

    <div
      v-if="closestRun"
      class="bed-soak-setup__last"
    >
      <span v-safe-html="closestRun" />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import type { TemperaturePreset } from '@/store/config/types'
import {
  BED_SOAK_SETTLED_MESHES,
  BedSoakColors,
  bedSoakMilestones,
  bedSoakStartCommand,
  type BedSoakRun
} from '@/util/tltg-bed-soak'
import { bedSoakDuration } from './bed-soak-format'

const CHAMBER_HEATER = 'heater_generic chamber'

/** Above this, the bed or chamber is still warm and the cold mesh won't be cold */
const WARM = 35

interface PresetChip {
  id: string | number;
  name: string;
  bed: number;
  chamber: number;
  selected: boolean;
}

@Component({})
export default class BedSoakSetup extends Mixins(StateMixin) {
  @Prop({ type: Object, required: true })
  readonly status!: Klipper.TltgBedSoakState

  /** Saved runs, newest first */
  @Prop({ type: Array, default: () => [] })
  readonly runs!: { started: number, run: BedSoakRun }[]

  readonly probeCounts = [5, 7, 9]
  readonly settledMeshes = BED_SOAK_SETTLED_MESHES
  readonly goodColor = BedSoakColors.good
  readonly warningColor = BedSoakColors.warning

  valid = true
  bed: number | string = 60
  chamber: number | string = 0
  probeCount = 5
  stopWhenSettled = true
  timeLimit: number | string = 90
  keepHeating = false

  created () {
    // Start from the last run's settings
    const settings = this.status.settings

    if (settings) {
      this.bed = settings.bed
      this.chamber = settings.chamber ?? 0
      this.probeCount = this.probeCounts.includes(settings.probe_count) ? settings.probe_count : 5
      this.stopWhenSettled = settings.stop_when_settled
      this.timeLimit = settings.time_limit
      this.keepHeating = settings.keep_heating
    }
  }

  @Watch('chamberAvailable')
  onChamberAvailable (value: boolean) {
    if (!value) this.chamber = 0
  }

  get chamberAvailable (): boolean {
    return this.status.chamber_available
  }

  get speedLimit (): string {
    return `${+((this.status.limits?.speed ?? 0.002) * 1000).toFixed(1)}`
  }

  get printerSettings (): Klipper.SettingsState {
    return this.$typedGetters['printer/getPrinterSettings']
  }

  get bedMax (): number {
    return +(this.printerSettings.heater_bed?.max_temp ?? 120)
  }

  get chamberMax (): number {
    return +(this.printerSettings[CHAMBER_HEATER]?.max_temp ?? 70)
  }

  get bedRules () {
    return [
      (v: unknown) => (typeof v === 'number' && v > 0) || this.$t('app.general.simple_form.error.min', { min: 1 }),
      (v: number) => v <= this.bedMax || this.$t('app.general.simple_form.error.max', { max: this.bedMax })
    ]
  }

  get chamberRules () {
    return [
      (v: unknown) => (typeof v === 'number' && v >= 0) || this.$t('app.general.simple_form.error.min', { min: 0 }),
      (v: number) => v <= this.chamberMax || this.$t('app.general.simple_form.error.max', { max: this.chamberMax })
    ]
  }

  get timeLimitRules () {
    return [
      (v: unknown) => (typeof v === 'number' && v >= 1) || this.$t('app.general.simple_form.error.min', { min: 1 }),
      (v: number) => v <= 240 || this.$t('app.general.simple_form.error.max', { max: 240 })
    ]
  }

  get bedTarget (): number {
    return Number(this.bed) || 0
  }

  get chamberTarget (): number {
    return this.chamberAvailable ? Number(this.chamber) || 0 : 0
  }

  get presets (): PresetChip[] {
    const presets: TemperaturePreset[] = this.$typedGetters['config/getTempPresets']

    return presets
      .filter(preset => preset.values.heater_bed?.active && preset.values.heater_bed.value > 0)
      .map(preset => {
        const bed = preset.values.heater_bed.value
        // Presets name heaters by their short name
        const chamberValue = preset.values.chamber
        const chamber = this.chamberAvailable && chamberValue?.active ? chamberValue.value : 0

        return {
          id: preset.id,
          name: preset.name,
          bed,
          chamber,
          selected: bed === this.bedTarget && chamber === this.chamberTarget
        }
      })
  }

  applyPreset (preset: PresetChip) {
    this.bed = preset.bed
    this.chamber = preset.chamber
  }

  get temperatures () {
    const printer = this.$typedState.printer.printer
    const chamber = printer[CHAMBER_HEATER] ?? printer['temperature_sensor chamber']

    return {
      bed: printer.heater_bed?.temperature as number | undefined,
      chamber: chamber?.temperature as number | undefined
    }
  }

  get idle (): boolean {
    return this.klippyReady && !this.printerBusy && this.status.state !== 'running'
  }

  get checks () {
    const checks = [{
      id: 'idle',
      ok: this.idle,
      label: this.$t(this.idle ? 'app.bed_soak.label.printer_idle' : 'app.bed_soak.label.printer_busy').toString(),
      sub: this.$t(this.idle ? 'app.bed_soak.hint.printer_idle' : 'app.bed_soak.hint.printer_busy').toString()
    }]

    const { bed, chamber } = this.temperatures

    if (bed != null) {
      checks.push({
        id: 'bed',
        ok: bed <= WARM,
        label: this.$t('app.bed_soak.label.bed_now', { temp: bed.toFixed(1) }).toString(),
        sub: this.$t(bed <= WARM ? 'app.bed_soak.hint.cool' : 'app.bed_soak.hint.warm').toString()
      })
    }

    if (chamber != null && this.chamberAvailable) {
      checks.push({
        id: 'chamber',
        ok: chamber <= WARM,
        label: this.$t('app.bed_soak.label.chamber_now', { temp: chamber.toFixed(1) }).toString(),
        sub: this.$t(chamber <= WARM ? 'app.bed_soak.hint.cool' : 'app.bed_soak.hint.warm').toString()
      })
    }

    return checks
  }

  get canStart (): boolean {
    return this.valid && this.idle && !this.hasWait(this.$waits.onBedSoakStart)
  }

  // The latest saved run at the same targets, as a reminder of what to expect
  get closestRun (): string | null {
    const match = this.runs.find(({ run }) => (
      run.settings.bed === this.bedTarget &&
      (run.settings.chamber ?? 0) === this.chamberTarget &&
      run.result != null
    ))

    if (!match) return null

    const milestones = bedSoakMilestones(match.run)
    const bold = (text: string) => `<b>${text}</b>`
    const targets = this.chamberTarget
      ? this.$t('app.bed_soak.label.targets', { bed: this.bedTarget, chamber: this.chamberTarget })
      : this.$t('app.bed_soak.label.targets_no_chamber', { bed: this.bedTarget })

    return this.$t('app.bed_soak.msg.closest_run', {
      date: this.$filters.formatDateTime(match.started * 1000),
      targets: bold(targets.toString()),
      bed: bold(milestones.bed != null ? bedSoakDuration(this, milestones.bed) : '—'),
      settled: bold(milestones.settled != null ? bedSoakDuration(this, milestones.settled) : this.$t('app.bed_soak.label.still_moving_value').toString())
    }).toString()
  }

  handleStart () {
    if (!this.canStart) return

    this.sendGcode(bedSoakStartCommand({
      bed: this.bedTarget,
      chamber: this.chamberTarget > 0 ? this.chamberTarget : null,
      probeCount: this.probeCount,
      timeLimit: Number(this.timeLimit),
      stopWhenSettled: this.stopWhenSettled,
      keepHeating: this.keepHeating
    }), this.$waits.onBedSoakStart)
  }
}
</script>

<style lang="scss" scoped>
  .bed-soak-setup__lead {
    max-width: 640px;
    opacity: 0.85;
  }

  .bed-soak-setup__presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .bed-soak-setup__preset-values {
    opacity: 0.65;
  }

  .bed-soak-setup__label {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .bed-soak-setup__hint {
    font-size: 0.75rem;
    opacity: 0.6;
    margin-top: 4px;
  }

  .bed-soak-setup__toggle {
    display: flex;

    .v-btn {
      flex: 1;
      height: 40px !important;
    }
  }

  .bed-soak-setup__checks {
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 4px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px 16px;
  }

  .bed-soak-setup__checks-title {
    grid-column: 1 / -1;
    font-size: 0.75rem;
    font-weight: 500;
    opacity: 0.8;
  }

  .bed-soak-setup__check {
    display: flex;
    align-items: flex-start;
    font-size: 0.8125rem;

    small {
      display: block;
      font-size: 0.75rem;
      opacity: 0.6;
    }
  }

  .bed-soak-setup__last {
    margin-top: 16px;
    padding: 10px 14px;
    border-left: 3px solid rgba(128, 128, 128, 0.5);
    background: rgba(128, 128, 128, 0.06);
    font-size: 0.8125rem;
  }
</style>
