<template>
  <app-dialog
    v-model="open"
    :title="$t('app.qidi_box.title.edit_slot', { slot: boxSlot.label })"
    width="420"
    :save-button-disabled="busy || draft.filament == null"
    @save="handleSave"
  >
    <v-card-text class="pt-4">
      <v-select
        :value="draft.vendor"
        :items="vendors"
        :label="$t('app.qidi_box.label.vendor')"
        class="mb-3"
        outlined
        dense
        hide-details
        @change="setVendor"
      />
      <v-select
        v-model="draft.filament"
        :items="filaments"
        :label="$t('app.qidi_box.label.filament')"
        class="mb-3"
        outlined
        dense
        hide-details
      />
      <div class="text-caption text--secondary mb-1">
        {{ $t('app.qidi_box.label.color') }}
      </div>
      <div class="d-flex flex-wrap align-center qidi-box-filament-dialog__colors">
        <div
          v-for="color in palette"
          :key="color"
          class="qidi-box-filament-dialog__color"
          :class="{ 'qidi-box-filament-dialog__color--selected': draft.color === color }"
          :style="{ backgroundColor: color }"
          @click="draft.color = color"
        />
        <input
          v-if="customColors"
          type="color"
          class="qidi-box-filament-dialog__custom"
          :value="draft.color || '#FFFFFF'"
          :title="$t('app.qidi_box.label.custom_color').toString()"
          @input="setCustomColor"
        >
      </div>
    </v-card-text>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop, VModel, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import { normalizeQidiColor, type QidiBoxSlot, type QidiFilament } from '@/util/qidi-box'

interface Draft {
  vendor: string | null;
  filament: string | null;
  color: string | null;
}

// Firmware 01.01.07.01 saves what the touchscreen saves: a QF filament ID from its filament database, which also
// carries the vendor, and any color as a one-element RGB list. Earlier firmware saves numeric filament, vendor,
// and color IDs from officiall_filas_list.cfg.
@Component({})
export default class QidiBoxFilamentDialog extends Mixins(StateMixin) {
  @VModel({ type: Boolean })
  open!: boolean

  @Prop({ type: Object, required: true })
  readonly boxSlot!: QidiBoxSlot

  @Prop({ type: Boolean })
  readonly busy!: boolean

  draft: Draft = { vendor: null, filament: null, color: null }

  get database (): readonly QidiFilament[] | null {
    return this.$typedGetters['qidiBox/getHasController'] ? this.$typedState.qidiBox.filamentDatabase : null
  }

  get list () {
    return this.$typedState.qidiBox.filamentList
  }

  get savedVendor (): string | null {
    const vendor = this.$typedState.printer.printer.save_variables?.variables?.[`vendor_slot${this.boxSlot.index}`]

    return vendor != null ? String(vendor) : null
  }

  get customColors () {
    return this.database != null
  }

  get vendors () {
    if (this.database) return Array.from(new Set(this.database.map(filament => filament.vendor)))

    return Object.entries(this.list?.vendor_list ?? {}).map(([value, text]) => ({ value, text }))
  }

  get filaments () {
    if (this.database) {
      return this.database
        .filter(filament => filament.vendor === this.draft.vendor)
        .map(filament => ({ value: filament.id, text: filament.name }))
    }

    return Object.entries(this.list ?? {})
      .filter(([key, entry]) => /^fila\d+$/.test(key) && entry.filament)
      .map(([key, entry]) => ({ value: key.slice(4), text: entry.filament }))
  }

  get colorIds (): Record<string, string> {
    return Object.fromEntries(Object.entries(this.list?.colordict ?? {})
      .map(([id, color]) => [normalizeQidiColor(color), id])
      .filter(([color]) => color != null))
  }

  get palette () {
    return Object.keys(this.colorIds)
  }

  @Watch('open', { immediate: true })
  onOpenChanged (value: boolean) {
    if (!value) return

    if (this.database) {
      const filament = this.database.find(filament => filament.id === this.boxSlot.filamentId)

      this.draft = { vendor: filament?.vendor ?? this.boxSlot.vendor, filament: filament?.id ?? null, color: this.boxSlot.color }
    } else {
      this.draft = { vendor: this.savedVendor, filament: this.boxSlot.filamentId, color: this.boxSlot.color }
    }
  }

  setCustomColor (event: Event) {
    this.draft = { ...this.draft, color: (event.target as HTMLInputElement).value.toUpperCase() }
  }

  // A vendor change keeps the filament type when that vendor has one.
  setVendor (vendor: string) {
    if (this.database) {
      const current = this.database.find(filament => filament.id === this.draft.filament)
      const candidates = this.database.filter(filament => filament.vendor === vendor)
      const next = candidates.find(filament => filament.type === current?.type) ?? candidates[0]

      this.draft = { ...this.draft, vendor, filament: next?.id ?? null }
    } else {
      this.draft = { ...this.draft, vendor }
    }
  }

  handleSave () {
    const { index } = this.boxSlot
    const { vendor, filament, color } = this.draft
    const lines: string[] = []

    if (filament == null || this.busy) return

    if (this.database) {
      if (filament !== this.boxSlot.filamentId) lines.push(`SAVE_VARIABLE VARIABLE=filament_slot${index} VALUE='"${filament}"'`)
      if (color && color !== this.boxSlot.color) lines.push(`SAVE_VARIABLE VARIABLE=color_slot${index} VALUE="['${color.slice(1)}']"`)
    } else {
      const colorId = color ? this.colorIds[color] : undefined

      if (filament !== this.boxSlot.filamentId) lines.push(`SAVE_VARIABLE VARIABLE=filament_slot${index} VALUE=${filament}`)
      if (vendor != null && vendor !== this.savedVendor) lines.push(`SAVE_VARIABLE VARIABLE=vendor_slot${index} VALUE=${vendor}`)
      if (colorId != null && color !== this.boxSlot.color) lines.push(`SAVE_VARIABLE VARIABLE=color_slot${index} VALUE=${colorId}`)
    }

    if (lines.length) this.sendGcode(lines.join('\n'))

    this.open = false
  }
}
</script>

<style scoped>
.qidi-box-filament-dialog__colors {
  gap: 6px;
}

.qidi-box-filament-dialog__color {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid rgba(128, 128, 128, 0.6);
}

.qidi-box-filament-dialog__color--selected {
  border: 3px solid #2196f3;
}

.qidi-box-filament-dialog__custom {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
}
</style>
