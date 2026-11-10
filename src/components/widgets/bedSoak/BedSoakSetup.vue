<template>
  <v-form
    ref="form"
    v-model="valid"
    class="bed-soak-setup"
    @submit.prevent="handleStart"
  >
    <v-row dense>
      <v-col
        cols="6"
        sm="3"
      >
        <v-text-field
          v-model.number="bed"
          :label="$t('app.bed_soak.label.bed')"
          suffix="°C"
          type="number"
          outlined
          dense
          hide-details="auto"
          :rules="bedRules"
        />
      </v-col>
      <v-col
        v-if="chamberAvailable"
        cols="6"
        sm="3"
      >
        <v-text-field
          v-model.number="chamber"
          :label="$t('app.bed_soak.label.chamber')"
          :placeholder="$t('app.bed_soak.label.off_value')"
          persistent-placeholder
          :suffix="chamberTarget > 0 ? '°C' : undefined"
          type="number"
          outlined
          dense
          hide-details="auto"
          :rules="chamberRules"
        />
      </v-col>
      <v-col
        cols="6"
        sm="3"
      >
        <v-select
          v-model="probeCount"
          :label="$t('app.bed_soak.label.mesh')"
          :items="probeCountItems"
          outlined
          dense
          hide-details
        />
      </v-col>
      <v-col
        cols="6"
        sm="3"
      >
        <v-text-field
          v-model.number="timeLimit"
          :label="$t('app.bed_soak.label.time_limit')"
          :suffix="$t('app.bed_soak.label.min')"
          type="number"
          outlined
          dense
          hide-details="auto"
          :rules="timeLimitRules"
        />
      </v-col>
    </v-row>

    <div class="d-flex flex-wrap align-center bed-soak-setup__actions">
      <v-switch
        v-model="stopWhenSettled"
        dense
        hide-details
        class="mt-0 me-6"
      >
        <template #label>
          {{ $t('app.bed_soak.label.stop_when_settled') }}
          <app-inline-help
            bottom
            small
            :tooltip="$t('app.bed_soak.tooltip.stop_when_settled', { limit: speedLimit, count: settledMeshes })"
          />
        </template>
      </v-switch>
      <v-switch
        v-model="keepHeating"
        :label="$t('app.bed_soak.label.keep_heating')"
        dense
        hide-details
        class="mt-0 me-6"
      />
      <v-spacer />
      <v-menu
        v-if="presets.length > 0"
        bottom
        left
        offset-y
        transition="slide-y-transition"
        min-width="150"
      >
        <template #activator="{ on, attrs, value }">
          <app-btn
            v-bind="attrs"
            small
            class="me-2 my-1"
            v-on="on"
          >
            <v-icon
              small
              class="me-1"
            >
              $fire
            </v-icon>
            {{ $t('app.general.btn.presets') }}
            <v-icon
              small
              class="ms-1"
              :class="{ 'rotate-180': value }"
            >
              $chevronDown
            </v-icon>
          </app-btn>
        </template>
        <v-list dense>
          <v-list-item
            v-for="preset in presets"
            :key="`preset:${preset.id}`"
            @click="applyPreset(preset)"
          >
            <v-list-item-content>
              <v-list-item-title>{{ preset.name }}</v-list-item-title>
            </v-list-item-content>
            <v-list-item-action-text class="ms-4">
              {{ presetTargets(preset) }}
            </v-list-item-action-text>
          </v-list-item>
        </v-list>
      </v-menu>
      <app-btn
        type="submit"
        small
        color="primary"
        class="my-1"
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

    <div
      v-if="lastRun"
      class="mt-3 secondary--text"
    >
      {{ lastRun }}
    </div>
  </v-form>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import type { TemperaturePreset } from '@/store/config/types'
import {
  BED_SOAK_SETTLED_MESHES,
  bedSoakMilestones,
  bedSoakStartCommand,
  type BedSoakRun
} from '@/util/tltg-bed-soak'
import { bedSoakDuration } from './bed-soak-format'

const CHAMBER_HEATER = 'heater_generic chamber'

/** Above this, the bed or chamber is still warm and the cold mesh won't be cold */
const WARM = 35

interface Preset {
  id: string | number;
  name: string;
  bed: number;
  chamber: number;
}

@Component({})
export default class BedSoakSetup extends Mixins(StateMixin) {
  @Prop({ type: Object, required: true })
  readonly status!: Klipper.TltgBedSoakState

  /** Saved runs, newest first */
  @Prop({ type: Array, default: () => [] })
  readonly runs!: { started: number, run: BedSoakRun }[]

  readonly settledMeshes = BED_SOAK_SETTLED_MESHES

  valid = true
  bed: number | string = 60
  chamber: number | string | null = null
  probeCount = 5
  stopWhenSettled = true
  timeLimit: number | string = 90
  keepHeating = false

  created () {
    // Start from the last run's settings
    const settings = this.status.settings

    if (settings) {
      this.bed = settings.bed
      this.chamber = settings.chamber || null
      this.probeCount = [5, 7, 9].includes(settings.probe_count) ? settings.probe_count : 5
      this.stopWhenSettled = settings.stop_when_settled
      this.timeLimit = settings.time_limit
      this.keepHeating = settings.keep_heating
    }
  }

  @Watch('chamberAvailable')
  onChamberAvailable (value: boolean) {
    if (!value) this.chamber = null
  }

  get probeCountItems () {
    return [5, 7, 9].map(count => ({ value: count, text: `${count} × ${count}` }))
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
      (v: unknown) => v == null || v === '' || (typeof v === 'number' && v >= 0) || this.$t('app.general.simple_form.error.min', { min: 0 }),
      (v: unknown) => typeof v !== 'number' || v <= this.chamberMax || this.$t('app.general.simple_form.error.max', { max: this.chamberMax })
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

  get presets (): Preset[] {
    const presets: TemperaturePreset[] = this.$typedGetters['config/getTempPresets']

    return presets
      .filter(preset => preset.values.heater_bed?.active && preset.values.heater_bed.value > 0)
      .map(preset => {
        // Presets name heaters by their short name
        const chamber = preset.values.chamber

        return {
          id: preset.id,
          name: preset.name,
          bed: preset.values.heater_bed.value,
          chamber: this.chamberAvailable && chamber?.active ? chamber.value : 0
        }
      })
  }

  presetTargets (preset: Preset) {
    return preset.chamber
      ? `${preset.bed} · ${preset.chamber} °C`
      : `${preset.bed} °C`
  }

  applyPreset (preset: Preset) {
    this.bed = preset.bed
    this.chamber = preset.chamber || null
  }

  get temperatures () {
    const printer = this.$typedState.printer.printer
    const chamber = printer[CHAMBER_HEATER] ?? printer['temperature_sensor chamber']

    return {
      bed: printer.heater_bed?.temperature as number | undefined,
      chamber: this.chamberAvailable ? chamber?.temperature as number | undefined : undefined
    }
  }

  get idle (): boolean {
    return this.klippyReady && !this.printerBusy && this.status.state !== 'running'
  }

  // One line, only when something is off
  get warning (): string | null {
    if (!this.idle) return this.$t('app.bed_soak.msg.not_idle').toString()

    const { bed, chamber } = this.temperatures
    const bedWarm = bed != null && bed > WARM
    const chamberWarm = chamber != null && chamber > WARM

    if (bedWarm && chamberWarm) {
      return this.$t('app.bed_soak.msg.both_warm', { bed: Math.round(bed), chamber: Math.round(chamber) }).toString()
    }
    if (bedWarm) return this.$t('app.bed_soak.msg.bed_warm', { temp: Math.round(bed) }).toString()
    if (chamberWarm) return this.$t('app.bed_soak.msg.chamber_warm', { temp: Math.round(chamber) }).toString()

    return null
  }

  get canStart (): boolean {
    return this.valid && this.idle && !this.hasWait(this.$waits.onBedSoakStart)
  }

  // The latest finished run at the same targets, as a reminder of what to expect
  get lastRun (): string | null {
    const match = this.runs.find(({ run }) => (
      run.result?.state === 'finished' &&
      run.settings.bed === this.bedTarget &&
      (run.settings.chamber ?? 0) === this.chamberTarget
    ))

    if (!match) return null

    const milestones = bedSoakMilestones(match.run)

    if (milestones.bed == null) return null

    const date = this.$filters.formatDate(match.started * 1000)

    return milestones.settled != null
      ? this.$t('app.bed_soak.msg.last_run', {
        date,
        bed: bedSoakDuration(this, milestones.bed),
        settled: bedSoakDuration(this, milestones.settled)
      }).toString()
      : this.$t('app.bed_soak.msg.last_run_moving', {
        date,
        bed: bedSoakDuration(this, milestones.bed),
        min: match.run.settings.time_limit ?? '—'
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
  .bed-soak-setup__actions {
    margin-top: 12px;
    row-gap: 4px;
  }
</style>
