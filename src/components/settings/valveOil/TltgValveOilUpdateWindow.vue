<template>
  <div>
    <v-divider />

    <app-setting
      :title="$t('app.tltg_valve_oil.label.update_window')"
      :r-cols="5"
    >
      <template #sub-title>
        <div>
          {{ hours ? $t('app.tltg_valve_oil.msg.update_window_hours') : $t('app.tltg_valve_oil.msg.update_window_any_time') }}
        </div>
        <div v-if="hours">
          {{ timezoneText }}
          <app-btn
            v-if="offeredTimezone"
            x-small
            text
            color="primary"
            class="px-1"
            :disabled="disabled"
            @click="$emit('save', { timezone: offeredTimezone })"
          >
            {{ $t('app.tltg_valve_oil.btn.use_timezone', { timezone: offeredTimezone }) }}
          </app-btn>
        </div>
      </template>

      <v-select
        filled
        dense
        single-line
        hide-details
        :items="modes"
        :value="hours ? 'hours' : 'any'"
        :disabled="disabled"
        @change="setMode"
      />
    </app-setting>

    <div
      v-if="hours || changed"
      class="px-4 pb-3"
    >
      <div class="d-flex align-center justify-end flex-wrap">
        <template v-if="hours">
          <v-select
            filled
            dense
            single-line
            hide-details
            :items="hourItems"
            :value="hours.start"
            :disabled="disabled"
            :aria-label="$t('app.tltg_valve_oil.label.update_window_start')"
            class="tltg-valve-oil-update-window__hour"
            @change="setHours({ start: $event })"
          />
          <span class="text-body-2 mx-2">
            {{ $t('app.tltg_valve_oil.label.update_window_to') }}
          </span>
          <v-select
            filled
            dense
            single-line
            hide-details
            :items="hourItems"
            :value="hours.end"
            :disabled="disabled"
            :aria-label="$t('app.tltg_valve_oil.label.update_window_end')"
            class="tltg-valve-oil-update-window__hour"
            @change="setHours({ end: $event })"
          />
        </template>

        <template v-if="changed">
          <app-btn
            small
            color="primary"
            class="ml-2 my-1"
            :loading="pending"
            :disabled="disabled || !valid"
            @click="save"
          >
            {{ $t('app.general.btn.save') }}
          </app-btn>
          <app-btn
            small
            text
            class="ml-1 my-1"
            :disabled="pending"
            @click="draft = undefined"
          >
            {{ $t('app.general.btn.cancel') }}
          </app-btn>
        </template>
      </div>

      <div
        v-if="!valid"
        class="text-caption error--text text-right mt-1"
      >
        {{ $t('app.tltg_valve_oil.msg.update_window_same_hour') }}
      </div>
    </div>

    <div
      v-if="error"
      class="px-4 pb-3"
    >
      <v-alert
        dense
        text
        type="error"
        dismissible
        class="mb-0"
        @input="$emit('dismiss-error')"
      >
        {{ $t('app.tltg_valve_oil.msg.update_window_failed', { error }) }}
      </v-alert>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import {
  tltgBrowserTimezone,
  tltgHourLabel,
  tltgUpdateWindowValid,
  type TltgStatusUpdateWindow,
  type TltgUpdateWindowHours
} from '@/util/tltg-status'

// The hours offered when a window is first set, before it's saved.
const SUGGESTED_HOURS: TltgUpdateWindowHours = { start: 2, end: 6 }

/**
 * The hours automatic updates start in, and the timezone they're read in. Edits are kept here until saved; the
 * section sends them (POST api/auto-update) and passes back whether that's pending and why it failed.
 */
@Component({})
export default class TltgValveOilUpdateWindow extends Vue {
  @Prop({ type: Object, required: true })
  readonly updateWindow!: TltgStatusUpdateWindow

  @Prop({ type: Boolean, default: false })
  readonly disabled!: boolean

  @Prop({ type: Boolean, default: false })
  readonly pending!: boolean

  @Prop({ type: String, default: '' })
  readonly error!: string

  // undefined while not edited; null for any time.
  draft: TltgUpdateWindowHours | null | undefined = undefined

  readonly browserTimezone = tltgBrowserTimezone()

  get hours (): TltgUpdateWindowHours | null {
    return this.draft === undefined ? this.updateWindow.hours : this.draft
  }

  get changed (): boolean {
    const saved = this.updateWindow.hours
    const draft = this.draft

    return draft !== undefined && (
      draft == null || saved == null
        ? draft !== saved
        : draft.start !== saved.start || draft.end !== saved.end
    )
  }

  get valid (): boolean {
    return this.hours == null || tltgUpdateWindowValid(this.hours)
  }

  // A window saved without a timezone is saved with this browser's.
  get savesBrowserTimezone (): boolean {
    return this.updateWindow.timezone == null && this.browserTimezone != null
  }

  get timezoneText (): string {
    const { timezone, timezone_source: source } = this.updateWindow

    if (this.changed && this.savesBrowserTimezone) {
      return this.$t('app.tltg_valve_oil.msg.update_window_timezone.browser', { timezone: this.browserTimezone }).toString()
    }

    if (timezone == null) {
      return this.$t('app.tltg_valve_oil.msg.update_window_timezone.utc').toString()
    }

    let key = source ?? 'unknown'

    if (source === 'browser' && timezone !== this.browserTimezone) {
      key = 'other_browser'
    }

    return this.$t(`app.tltg_valve_oil.msg.update_window_timezone.${key}`, { timezone }).toString()
  }

  // This browser's timezone, when the window is read in another; not while the hours are being edited, as saving it
  // shows the window as the printer has it.
  get offeredTimezone (): string | null {
    const browser = this.browserTimezone

    if (browser == null || this.changed) {
      return null
    }

    return browser !== (this.updateWindow.timezone ?? 'UTC') ? browser : null
  }

  get modes () {
    return [
      { value: 'any', text: this.$t('app.tltg_valve_oil.label.update_window_any_time') },
      { value: 'hours', text: this.$t('app.tltg_valve_oil.label.update_window_hours') }
    ]
  }

  get hourItems () {
    return Array.from({ length: 24 }, (_, hour) => ({ value: hour, text: tltgHourLabel(hour) }))
  }

  @Watch('pending')
  onPendingChanged (pending: boolean) {
    // Saved: show the window as the printer now has it.
    if (!pending && !this.error) {
      this.draft = undefined
    }
  }

  setMode (mode: string) {
    this.draft = mode === 'hours'
      ? this.hours ?? this.updateWindow.hours ?? { ...SUGGESTED_HOURS }
      : null
  }

  setHours (change: Partial<TltgUpdateWindowHours>) {
    this.draft = { ...(this.hours ?? SUGGESTED_HOURS), ...change }
  }

  save () {
    if (!this.changed || !this.valid) {
      return
    }

    this.$emit('save', {
      window: this.hours,
      ...(this.hours && this.savesBrowserTimezone ? { timezone: this.browserTimezone } : {})
    })
  }
}
</script>

<style lang="scss" scoped>
  .tltg-valve-oil-update-window__hour {
    max-width: 120px;
  }
</style>
