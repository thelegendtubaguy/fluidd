<template>
  <!-- Qidi-Max-4-Optimized's Box load/unload motion: reads printer.tltg_box_feed_motion and edits only through
       TLTG_BOX_MOTION. -->
  <div>
    <div class="text-subtitle-1">
      {{ $t('app.qidi_box.motion.title') }}
    </div>

    <div
      v-if="!active"
      class="text-body-2 text--secondary"
    >
      {{ (motion && motion.status) || $t('app.qidi_box.motion.unavailable') }}
    </div>

    <template v-else>
      <div
        v-for="note in notes"
        :key="note"
        class="warning--text text-caption"
      >
        {{ note }}
      </div>
      <div
        v-if="locked && !pending"
        class="text-caption text--secondary"
      >
        {{ $t('app.qidi_box.motion.printing') }}
      </div>

      <div class="text-caption text--secondary mt-2 mb-2">
        {{ $t('app.qidi_box.motion.all_slots') }}
      </div>
      <v-row dense>
        <v-col
          v-for="field in fieldsFor('global')"
          :key="field"
          cols="6"
          sm="3"
        >
          <v-text-field
            v-bind="fieldProps('global', field, values('global'))"
            @input="setDraft('global', field, $event)"
          />
        </v-col>
      </v-row>
      <div
        v-if="errors.global"
        class="error--text text-body-2 mt-1"
        role="alert"
      >
        {{ errors.global }}
      </div>
      <div class="d-flex flex-wrap justify-end mt-1">
        <app-btn
          small
          text
          color="primary"
          class="ml-2"
          :disabled="locked"
          @click="resetAll"
        >
          {{ $t('app.qidi_box.btn.reset') }}
        </app-btn>
        <app-btn
          small
          color="primary"
          class="ml-2"
          :disabled="locked || !hasChanges('global')"
          @click="apply('global')"
        >
          {{ $t('app.qidi_box.btn.apply') }}
        </app-btn>
      </div>

      <template v-for="(key, i) in slotKeys">
        <v-divider
          :key="`divider-${key}`"
          :class="{ 'mt-2': i === 0 }"
        />
        <div
          :key="key"
          class="py-2"
        >
          <div class="d-flex align-center">
            <span class="font-weight-bold">{{ slotLabel(key) }}</span>
            <v-spacer />
            <app-btn
              x-small
              text
              color="primary"
              @click="toggle(key)"
            >
              {{ open === key ? $t('app.qidi_box.btn.close') : $t('app.qidi_box.btn.edit') }}
            </app-btn>
          </div>
          <div class="text-body-2">
            <span
              v-for="(part, j) in slotSummary(key)"
              :key="j"
              :class="{ 'primary--text font-weight-bold': part.overridden }"
              :title="part.overridden ? $t('app.qidi_box.motion.slot_override').toString() : undefined"
            >{{ part.text }}</span>
          </div>
          <div
            v-for="error in slotErrors(key)"
            :key="error"
            class="error--text text-caption"
          >
            {{ error }}
          </div>

          <div
            v-if="open === key"
            class="mt-2"
          >
            <div class="text-caption text--secondary mb-2">
              {{ $t('app.qidi_box.motion.slot_blank') }}
            </div>
            <v-row dense>
              <v-col
                v-for="field in fieldsFor(key)"
                :key="field"
                cols="6"
                sm="3"
              >
                <v-text-field
                  v-bind="fieldProps(key, field, values(key))"
                  @input="setDraft(key, field, $event)"
                />
              </v-col>
            </v-row>
            <div
              v-if="errors[key]"
              class="error--text text-body-2 mt-1"
              role="alert"
            >
              {{ errors[key] }}
            </div>
            <div class="d-flex flex-wrap justify-end mt-1">
              <app-btn
                small
                text
                color="primary"
                class="ml-2"
                :disabled="locked"
                @click="resetSlot(key)"
              >
                {{ $t('app.qidi_box.btn.reset_slot') }}
              </app-btn>
              <app-btn
                small
                color="primary"
                class="ml-2"
                :disabled="locked || !hasChanges(key)"
                @click="apply(key)"
              >
                {{ $t('app.qidi_box.btn.apply') }}
              </app-btn>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import { SocketActions } from '@/api/socketActions'
import { isSocketError } from '@/util/is-socket-error'
import { qidiBoxSlotLabel, qidiBoxSlotNumber } from '@/util/qidi-box'

const FIELDS = [
  'fast_length',
  'fast_speed_1',
  'fast_speed_2',
  'approach_speed',
  'load_accel',
  'unload_speed_1',
  'unload_speed_2',
  'unload_accel',
  'unload_extruder_length'
]

// Settings that apply to every slot and have no per-slot override.
const GLOBAL_ONLY = ['unload_extruder_length']

type MotionValues = Record<string, unknown>

interface MotionLimit {
  min: number;
  max: number;
  unit?: string;
}

interface MotionStatus {
  active?: boolean;
  status?: string;
  limits: Record<string, MotionLimit>;
  vendor: Record<string, number>;
  settings: MotionValues;
  problems?: string[];
  vendor_keys?: string[];
  slots: Record<string, {
    overrides?: MotionValues;
    load?: Record<string, unknown>;
    unload?: Record<string, unknown>;
  } | null>;
}

const isSet = (value: unknown) => value !== null && value !== undefined

@Component({})
export default class QidiBoxMotion extends Mixins(StateMixin) {
  open: string | null = null
  drafts: Record<string, Record<string, string>> = {}
  errors: Record<string, string> = {}
  pending = false

  get motion (): MotionStatus | null {
    const value = this.$typedState.printer.printer.tltg_box_feed_motion

    return value != null && typeof value === 'object' ? value as MotionStatus : null
  }

  get active (): boolean {
    const motion = this.motion

    return !!(motion?.active && motion.settings && motion.vendor && motion.limits)
  }

  get notes (): string[] {
    const motion = this.motion
    const notes = [...(motion?.problems ?? [])]

    if (motion?.vendor_keys?.length) {
      notes.push(this.$t('app.qidi_box.motion.vendor_keys', { keys: motion.vendor_keys.join(', ') }).toString())
    }

    return notes
  }

  get slotKeys (): string[] {
    const slots = this.motion?.slots ?? {}

    return Object.keys(slots)
      .filter(key => qidiBoxSlotNumber(key) != null && slots[key])
      .sort((a, b) => (qidiBoxSlotNumber(a) ?? 0) - (qidiBoxSlotNumber(b) ?? 0))
  }

  get locked (): boolean {
    const state = this.$typedState.printer.printer.print_stats?.state

    return this.pending || state === 'printing' || state === 'paused' || !this.klippyReady
  }

  fieldsFor (scope: string): string[] {
    return FIELDS.filter(field => scope === 'global' || !GLOBAL_ONLY.includes(field))
  }

  slotLabel (key: string): string {
    return qidiBoxSlotLabel(qidiBoxSlotNumber(key) ?? 0)
  }

  limitText (field: string): string {
    const limit = this.motion?.limits[field]

    return limit ? `${limit.min}–${limit.max} ${limit.unit ?? ''}`.trim() : ''
  }

  invalid (field: string, raw: unknown): boolean {
    const value = String(isSet(raw) ? raw : '').trim()
    const limit = this.motion?.limits[field]

    if (value === '' || !limit) return false

    const number = Number(value)

    return !/^\d+$/.test(value) || number < limit.min || number > limit.max
  }

  // Status publishes an unusable saved value as its repr string, or as an out-of-range number.
  badSaved (field: string, value: unknown): boolean {
    return isSet(value) && (typeof value !== 'number' || this.invalid(field, value))
  }

  // Saved values for a scope: the global settings, or a slot's overrides.
  values (scope: string): MotionValues {
    return (scope === 'global' ? this.motion?.settings : this.motion?.slots[scope]?.overrides) ?? {}
  }

  placeholder (scope: string, field: string): string {
    const motion = this.motion

    if (scope !== 'global') {
      const global = motion?.settings[field]

      if (isSet(global) && !this.badSaved(field, global)) return String(global)
    }

    return String(motion?.vendor[field] ?? '')
  }

  fieldProps (scope: string, field: string, values: MotionValues) {
    const drafts = this.drafts[scope] ?? {}
    const saved = values[field]
    const bad = !(field in drafts) && this.badSaved(field, saved)

    return {
      value: field in drafts ? drafts[field] : isSet(saved) && !bad ? String(saved) : '',
      label: this.$t(`app.qidi_box.motion.fields.${field}`),
      placeholder: this.placeholder(scope, field),
      persistentPlaceholder: true,
      hint: this.limitText(field),
      rules: [(value: string) => !this.invalid(field, value) || this.$t('app.qidi_box.motion.whole_number', { range: this.limitText(field) })],
      errorMessages: bad ? this.$t('app.qidi_box.motion.invalid_saved', { value: String(saved) }) : undefined,
      type: 'number',
      outlined: true,
      dense: true,
      hideDetails: 'auto',
      disabled: this.locked
    }
  }

  // Changed parameters only; a cleared field, or an untouched unusable saved value, is unset with the scope's
  // clear word. Returns null while any field is invalid.
  changes (scope: string): string[] | null {
    const motion = this.motion

    if (motion == null) return null

    const drafts = this.drafts[scope] ?? {}
    const current = this.values(scope)
    const clear = scope === 'global' ? 'vendor' : 'global'
    const params: string[] = []

    for (const field of this.fieldsFor(scope)) {
      if (!(field in drafts)) {
        if (this.badSaved(field, current[field])) params.push(`${field.toUpperCase()}=${clear}`)
        continue
      }

      const value = String(drafts[field] ?? '').trim()

      if (this.invalid(field, value)) return null

      if (value === '') {
        if (isSet(current[field])) params.push(`${field.toUpperCase()}=${clear}`)
      } else if (Number(value) !== current[field]) {
        params.push(`${field.toUpperCase()}=${Number(value)}`)
      }
    }

    return params
  }

  hasChanges (scope: string): boolean {
    return (this.changes(scope)?.length ?? 0) > 0
  }

  slotSummary (key: string) {
    const slot = this.motion?.slots[key]
    const overrides = slot?.overrides ?? {}
    const load = slot?.load ?? {}
    const unload = slot?.unload ?? {}
    const value = (part: unknown, setting: string) => ({
      text: isSet(part) ? String(part) : '?',
      overridden: isSet(overrides[setting])
    })
    const text = (part: string) => ({ text: part, overridden: false })

    return [
      text(`${this.$t('app.qidi_box.motion.load')} `),
      value(load.fast_length, 'fast_length'),
      text(' mm @ '),
      value(load.fast_speed_1, 'fast_speed_1'),
      text('/'),
      value(load.fast_speed_2, 'fast_speed_2'),
      text(' → '),
      value(load.approach_speed, 'approach_speed'),
      text(` mm/s, ${this.$t('app.qidi_box.motion.accel')} `),
      value(load.accel, 'load_accel'),
      text(`; ${this.$t('app.qidi_box.motion.unload')} `),
      value(unload.speed_1, 'unload_speed_1'),
      text('/'),
      value(unload.speed_2, 'unload_speed_2'),
      text(` mm/s, ${this.$t('app.qidi_box.motion.accel')} `),
      value(unload.accel, 'unload_accel')
    ]
  }

  slotErrors (key: string): string[] {
    const slot = this.motion?.slots[key]

    return ([
      [this.$t('app.qidi_box.motion.load'), slot?.load],
      [this.$t('app.qidi_box.motion.unload'), slot?.unload]
    ] as const)
      .filter(([, part]) => part?.state === 'error' && part.error)
      .map(([label, part]) => `${label}: ${part?.error}`)
  }

  setDraft (scope: string, field: string, value: string) {
    this.$set(this.drafts, scope, { ...this.drafts[scope], [field]: value })
  }

  clearScope (scope: string) {
    this.$delete(this.drafts, scope)
    this.$delete(this.errors, scope)
  }

  toggle (key: string) {
    if (this.open) this.clearScope(this.open)

    this.open = this.open === key ? null : key
  }

  // The refused command's reason comes back with the request, so it is shown beside the fields.
  async run (scope: string, script: string, confirmation?: string) {
    if (this.locked) return

    if (confirmation) {
      const confirmed = await this.$confirm(confirmation, {
        title: this.$t('app.qidi_box.motion.title').toString(),
        color: 'card-heading',
        icon: '$error'
      })

      if (!confirmed) return
    }

    this.pending = true
    this.$delete(this.errors, scope)
    this.addConsoleEntry(script)

    try {
      await SocketActions.printerGcodeScript(script, { suppressError: true })
      this.$delete(this.drafts, scope)
    } catch (error) {
      this.$set(this.errors, scope, isSocketError(error) ? error.message : String(error))
    } finally {
      this.pending = false
    }
  }

  apply (scope: string) {
    const params = this.changes(scope)

    if (!params?.length) return

    const target = scope === 'global' ? '' : ` SLOT=${qidiBoxSlotNumber(scope)}`

    this.run(scope, `TLTG_BOX_MOTION${target} ${params.join(' ')}`)
  }

  resetAll () {
    this.run('global', 'TLTG_BOX_MOTION RESET=1', this.$t('app.qidi_box.motion.reset_confirm').toString())
  }

  resetSlot (key: string) {
    this.run(
      key,
      `TLTG_BOX_MOTION SLOT=${qidiBoxSlotNumber(key)} RESET=1`,
      this.$t('app.qidi_box.motion.reset_slot_confirm', { slot: this.slotLabel(key) }).toString()
    )
  }
}
</script>
