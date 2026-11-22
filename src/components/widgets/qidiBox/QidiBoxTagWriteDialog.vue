<template>
  <app-dialog
    v-model="open"
    :title="$t('app.qidi_box.title.write_tag', { slot: boxSlot.label })"
    width="460"
  >
    <v-card-text class="pt-4">
      <div class="d-flex align-center mb-4 qidi-box-tag-dialog__head">
        <qidi-box-spool
          :box-slot="previewSlot"
          :label="boxSlot.label"
          :size="48"
        />
        <div
          v-if="phase === 'form'"
          class="text-body-2 text--secondary"
        >
          {{ $t('app.qidi_box.tag.intro') }}
        </div>
        <div v-else>
          <div class="text-subtitle-1 font-weight-medium">
            {{ filamentName }}
          </div>
          <div class="d-flex align-center qidi-box-tag-dialog__chips">
            <span
              v-for="(color, index) in colors"
              :key="`chip:${index}`"
              class="qidi-box-tag-dialog__chip"
              :style="{ backgroundColor: color }"
            />
            <span class="text-caption text--secondary">{{ colors.join(' · ') }}</span>
          </div>
        </div>
      </div>

      <template v-if="phase === 'form'">
        <v-select
          :value="vendor"
          :items="vendors"
          :label="$t('app.qidi_box.label.vendor')"
          class="mb-3"
          outlined
          dense
          hide-details
          @change="setVendor"
        />
        <v-select
          v-model="filament"
          :items="filaments"
          :label="$t('app.qidi_box.label.filament')"
          class="mb-3"
          outlined
          dense
          hide-details
        />
        <div class="text-caption text--secondary mb-1">
          {{ $t('app.qidi_box.label.colors') }}
        </div>
        <div class="d-flex flex-wrap align-center mb-2 qidi-box-tag-dialog__colors">
          <div
            v-for="(color, index) in colors"
            :key="`color:${index}`"
            class="qidi-box-tag-dialog__slot"
          >
            <div
              class="qidi-box-tag-dialog__color qidi-box-tag-dialog__color--large"
              :class="{ 'qidi-box-tag-dialog__color--selected': picked === index }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="picked = index"
            />
            <app-btn
              v-if="colors.length > 1 && picked === index"
              icon
              x-small
              class="qidi-box-tag-dialog__remove"
              :aria-label="$t('app.qidi_box.label.remove_color')"
              @click="removeColor(index)"
            >
              <v-icon x-small>
                $close
              </v-icon>
            </app-btn>
          </div>
          <app-btn
            v-if="colors.length < 4"
            icon
            small
            :aria-label="$t('app.qidi_box.label.add_color')"
            @click="addColor"
          >
            <v-icon small>
              $plus
            </v-icon>
          </app-btn>
        </div>
        <div class="d-flex flex-wrap align-center mb-3 qidi-box-tag-dialog__colors">
          <div
            v-for="color in palette"
            :key="color"
            class="qidi-box-tag-dialog__color"
            :class="{ 'qidi-box-tag-dialog__color--selected': colors[picked] === color }"
            :style="{ backgroundColor: color }"
            @click="setColor(color)"
          />
          <input
            type="color"
            class="qidi-box-tag-dialog__custom"
            :value="colors[picked] || '#FFFFFF'"
            :title="$t('app.qidi_box.label.custom_color').toString()"
            @input="setCustomColor"
          >
        </div>
        <v-alert
          text
          dense
          color="secondary"
          :icon="turns ? '$qidiBoxTurnSpool' : '$qidiBoxTurnByHand'"
          class="mb-0 text-body-2"
        >
          {{ turns ? $t('app.qidi_box.tag.turns') : $t('app.qidi_box.tag.by_hand') }}
          {{ $t('app.qidi_box.tag.rules') }}
        </v-alert>
      </template>

      <template v-else-if="phase === 'running'">
        <div class="d-flex align-center text-body-2 mb-2">
          <span>{{ turns ? $t('app.qidi_box.tag.turning') : $t('app.qidi_box.tag.by_hand_running') }}</span>
          <v-spacer />
          <span class="text--secondary">{{ progressText }}</span>
        </div>
        <v-progress-linear
          :value="progress"
          rounded
          height="6"
        />
        <div
          v-if="job && job.lost"
          class="text-caption text--secondary mt-2"
        >
          {{ $t('app.qidi_box.tag.lost') }}
        </div>
      </template>

      <v-alert
        v-else-if="phase === 'done'"
        text
        dense
        type="success"
        class="mb-0"
      >
        {{ $t('app.qidi_box.tag.done', { filament: filamentName }) }}
      </v-alert>

      <v-alert
        v-else
        text
        dense
        type="error"
        class="mb-0"
      >
        {{ failure }}
      </v-alert>
    </v-card-text>

    <template #actions>
      <v-spacer />
      <template v-if="phase === 'form'">
        <app-btn
          color="warning"
          text
          @click="open = false"
        >
          {{ $t('app.general.btn.cancel') }}
        </app-btn>
        <app-btn
          color="primary"
          :disabled="busy || filament == null"
          @click="write"
        >
          {{ $t('app.qidi_box.btn.write_tag_start') }}
        </app-btn>
      </template>
      <app-btn
        v-else-if="phase === 'running'"
        text
        @click="open = false"
      >
        {{ $t('app.qidi_box.btn.write_tag_hide') }}
      </app-btn>
      <app-btn
        v-else-if="phase === 'done'"
        color="primary"
        @click="open = false"
      >
        {{ $t('app.qidi_box.btn.close') }}
      </app-btn>
      <template v-else>
        <app-btn
          text
          @click="open = false"
        >
          {{ $t('app.qidi_box.btn.close') }}
        </app-btn>
        <app-btn
          color="primary"
          @click="phase = 'form'"
        >
          {{ $t('app.qidi_box.btn.write_tag_retry') }}
        </app-btn>
      </template>
    </template>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop, VModel } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import { SocketActions } from '@/api/socketActions'
import { isSocketError } from '@/util/is-socket-error'
import { normalizeQidiColor, type QidiBoxSlot, type QidiFilament } from '@/util/qidi-box'
import QidiBoxSpool from './QidiBoxSpool.vue'

// Valve Oil's vo_box_rfid publishes each VO_BOX_RFID_WRITE and VO_BOX_RFID_TEST run here.
interface TagJob {
  run: number;
  running: boolean;
  action?: string;
  test?: boolean;
  seconds?: number;
  elapsed?: number;
  turn?: number;
  turned?: number;
  lost?: number;
  result?: { written: boolean, verified: boolean, layout: string } | null;
}

const MAX_COLORS = 4
const REFUSALS = ['bambu', 'locked', 'unsupported']
// Tag formats the Box already reads, which Valve Oil never writes over.
const BRANDS: Record<string, string> = {
  anycubic: 'Anycubic', elegoo: 'Elegoo', creality: 'Creality', tigertag: 'TigerTag', opentag3d: 'OpenTag3D'
}

// Writes a filament to the RFID tag on a Box slot's spool with Valve Oil's VO_BOX_RFID_WRITE. The Box turns a spool
// sitting on an empty slot's rollers until its tag comes past the reader; with filament fed, the operator turns it.
@Component({
  components: {
    QidiBoxSpool
  }
})
export default class QidiBoxTagWriteDialog extends Mixins(StateMixin) {
  @VModel({ type: Boolean })
  open!: boolean

  @Prop({ type: Object, required: true })
  readonly boxSlot!: QidiBoxSlot

  @Prop({ type: Boolean })
  readonly busy!: boolean

  vendor: string | null = null
  filament: string | null = null
  colors: string[] = ['#FFFFFF']
  picked = 0
  phase: 'form' | 'running' | 'done' | 'failed' = 'form'
  message = ''
  startRun = 0

  get database (): readonly QidiFilament[] {
    return this.$typedState.qidiBox.filamentDatabase ?? []
  }

  get variables (): Record<string, unknown> {
    return this.$typedState.printer.printer.save_variables?.variables ?? {}
  }

  get vendors (): string[] {
    return Array.from(new Set(this.database.map(filament => filament.vendor))).sort((a, b) => a.localeCompare(b))
  }

  get filaments () {
    return this.database
      .filter(filament => filament.vendor === this.vendor)
      .map(filament => ({ value: filament.id, text: filament.name }))
  }

  // The spool as it will read: the first color, spinning while the write runs.
  get previewSlot (): QidiBoxSlot {
    return { ...this.boxSlot, present: true, color: this.colors[0] ?? null, reading: this.phase === 'running' }
  }

  get filamentName (): string {
    return this.database.find(filament => filament.id === this.filament)?.name ?? ''
  }

  get palette (): string[] {
    return Object.values(this.$typedState.qidiBox.filamentList?.colordict ?? {})
      .map(color => normalizeQidiColor(color))
      .filter((color, index, all): color is string => color != null && all.indexOf(color) === index)
  }

  // A spool on an empty slot's rollers is turned by the Box; QIDI counts the slot empty only with nothing fed.
  get turns (): boolean {
    return !this.boxSlot.present && Number(this.variables[`slot${this.boxSlot.index}`] ?? 0) === 0
  }

  get job (): TagJob | null {
    const job: TagJob | undefined = this.$typedState.printer.printer.vo_box_rfid?.job

    return job && job.run > this.startRun && job.action === 'write' && !job.test ? job : null
  }

  get progress (): number {
    const job = this.job

    if (!job) return 0
    if (job.turn) return Math.min(100, ((job.turned ?? 0) / Math.abs(job.turn)) * 100)

    return job.seconds ? Math.min(100, ((job.elapsed ?? 0) / job.seconds) * 100) : 0
  }

  get progressText (): string {
    const job = this.job

    if (!job) return ''
    if (job.turn) {
      return this.$t('app.qidi_box.tag.turning_progress', { turned: Math.round(job.turned ?? 0), turn: Math.abs(job.turn) }).toString()
    }

    return this.$t('app.qidi_box.tag.seconds_left', { seconds: Math.max(0, Math.round((job.seconds ?? 0) - (job.elapsed ?? 0))) }).toString()
  }

  // Why the tag wasn't written, from the run's result when it has one.
  get failure (): string {
    const result = this.job?.result

    if (result && !result.written && BRANDS[result.layout]) {
      return this.$t('app.qidi_box.tag.refused_brand', { brand: BRANDS[result.layout] }).toString()
    }
    if (result && !result.written) {
      const layout = REFUSALS.includes(result.layout) ? result.layout : 'other'

      return this.$t(`app.qidi_box.tag.refused_${layout}`).toString()
    }
    if (result && !result.verified) return this.$t('app.qidi_box.tag.unverified').toString()
    if (this.job && !this.job.running && !result) return this.$t('app.qidi_box.tag.not_found').toString()

    return this.message
  }

  created () {
    // Start from the slot's own filament and colors.
    const filament = this.database.find(filament => filament.id === this.boxSlot.filamentId)
    const saved = this.variables[`color_slot${this.boxSlot.index}`]
    const colors = (Array.isArray(saved) ? saved : [saved, this.boxSlot.color])
      .map(color => normalizeQidiColor(color))
      .filter((color): color is string => color != null)

    this.vendor = filament?.vendor ?? this.vendors[0] ?? null
    this.filament = filament?.id ?? this.filaments[0]?.value ?? null
    if (colors.length) this.colors = colors.slice(0, MAX_COLORS)
  }

  // A vendor change keeps the filament type when that vendor has one.
  setVendor (vendor: string) {
    const current = this.database.find(filament => filament.id === this.filament)
    const candidates = this.database.filter(filament => filament.vendor === vendor)

    this.vendor = vendor
    this.filament = (candidates.find(filament => filament.type === current?.type) ?? candidates[0])?.id ?? null
  }

  setColor (color: string) {
    this.colors = this.colors.map((value, index) => index === this.picked ? color.toUpperCase() : value)
  }

  setCustomColor (event: Event) {
    this.setColor((event.target as HTMLInputElement).value)
  }

  addColor () {
    this.colors = [...this.colors, this.colors[this.colors.length - 1]]
    this.picked = this.colors.length - 1
  }

  removeColor (index: number) {
    this.colors = this.colors.filter((_, i) => i !== index)
    this.picked = 0
  }

  async write () {
    if (this.busy || this.filament == null) return

    const script = `VO_BOX_RFID_WRITE SLOT=${this.boxSlot.index} FILAMENT=${this.filament} COLORS=${this.colors.map(color => color.slice(1)).join(',')}`

    this.startRun = this.$typedState.printer.printer.vo_box_rfid?.job?.run ?? 0
    this.message = ''
    this.phase = 'running'
    this.addConsoleEntry(script)

    try {
      await SocketActions.printerGcodeScript(script, { suppressError: true })
      this.phase = 'done'
    } catch (error) {
      this.message = isSocketError(error) ? error.message : String(error)
      this.phase = 'failed'
    }
  }
}
</script>

<style scoped>
.qidi-box-tag-dialog__head {
  gap: 14px;
}

.qidi-box-tag-dialog__chips {
  gap: 4px;
}

.qidi-box-tag-dialog__chip {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(128, 128, 128, 0.6);
}

.qidi-box-tag-dialog__colors {
  gap: 6px;
}

.qidi-box-tag-dialog__slot {
  position: relative;
}

.qidi-box-tag-dialog__remove {
  position: absolute;
  top: -8px;
  right: -8px;
}

.qidi-box-tag-dialog__color {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid rgba(128, 128, 128, 0.6);
}

.qidi-box-tag-dialog__color--large {
  width: 32px;
  height: 32px;
}

.qidi-box-tag-dialog__color--selected {
  border: 3px solid #2196f3;
}

.qidi-box-tag-dialog__custom {
  width: 30px;
  height: 30px;
  border: none;
  background: none;
  cursor: pointer;
}
</style>
