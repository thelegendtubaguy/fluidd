<template>
  <app-dialog
    v-model="open"
    :title="$t('app.qidi_box.title.tool_mapping')"
    width="620"
    :save-button-disabled="locked"
    @save="handleSave"
  >
    <v-card-text class="pt-4">
      <p class="text-body-2 text--secondary">
        {{ $t('app.qidi_box.msg.tool_mapping_help') }}
      </p>

      <div class="qidi-box-tool-map-dialog__grid">
        <div
          v-for="tool in toolCount"
          :key="tool - 1"
          class="d-flex align-center qidi-box-tool-map-dialog__row"
        >
          <span class="font-weight-bold text-right qidi-box-tool-map-dialog__tool">T{{ tool - 1 }}</span>
          <v-select
            :value="draft[tool - 1]"
            :items="items"
            :placeholder="$t('app.qidi_box.label.not_mapped')"
            :menu-props="{ offsetY: true }"
            outlined
            dense
            hide-details
            @change="setTool(tool - 1, $event)"
          >
            <template #item="{ item }">
              <span
                class="qidi-box-swatch mr-2"
                :style="{ backgroundColor: item.color || 'transparent' }"
              />
              {{ item.text }}
            </template>
            <template #selection="{ item }">
              <span
                class="qidi-box-swatch mr-2"
                :style="{ backgroundColor: item.color || 'transparent' }"
              />
              <span class="text-truncate">{{ item.text }}</span>
            </template>
          </v-select>
        </div>
      </div>
    </v-card-text>

    <template #actions>
      <app-btn
        text
        color="primary"
        @click="setDefault"
      >
        {{ $t('app.qidi_box.btn.default') }}
      </app-btn>
      <v-spacer />
      <app-btn
        text
        color="primary"
        @click="open = false"
      >
        {{ $t('app.general.btn.cancel') }}
      </app-btn>
      <app-btn
        color="primary"
        :disabled="locked"
        @click="handleSave"
      >
        {{ $t('app.general.btn.save') }}
      </app-btn>
    </template>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Prop, VModel, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import { QIDI_BOX_EXTERNAL_SLOT, type QidiBoxSlot } from '@/util/qidi-box'

@Component({})
export default class QidiBoxToolMapDialog extends Mixins(StateMixin) {
  @VModel({ type: Boolean })
  open!: boolean

  @Prop({ type: Array, required: true })
  readonly slots!: QidiBoxSlot[]

  @Prop({ type: Object, required: true })
  readonly toolMap!: Record<number, number>

  @Prop({ type: Boolean })
  readonly locked!: boolean

  draft: Record<number, number> = {}

  get boxSlotCount () {
    return this.slots.filter(slot => slot.index !== QIDI_BOX_EXTERNAL_SLOT).length
  }

  // Tools for every Box slot, plus any mapped beyond them.
  get toolCount () {
    const mapped = Object.keys(this.toolMap).reduce((most, tool) => Math.max(most, Number(tool) + 1), 0)

    return Math.min(16, Math.max(this.boxSlotCount, mapped, 1))
  }

  get items () {
    return this.slots.map(slot => ({
      value: slot.index,
      text: `${slot.label} · ${slot.present ? slot.name || this.$t('app.qidi_box.label.unknown_filament') : this.$t('app.qidi_box.label.empty')}`,
      color: slot.present ? slot.color : null
    }))
  }

  @Watch('open', { immediate: true })
  onOpenChanged (value: boolean) {
    if (value) this.draft = { ...this.toolMap }
  }

  setTool (tool: number, slot: number) {
    this.draft = { ...this.draft, [tool]: slot }
  }

  // T0 → 1A, T1 → 1B, and so on for every Box slot.
  setDefault () {
    const draft = { ...this.draft }

    for (let tool = 0; tool < Math.min(16, this.boxSlotCount); tool++) draft[tool] = tool

    this.draft = draft
  }

  // Writes only changed tools, in the format the print dialog uses.
  handleSave () {
    if (this.locked) return

    const script = Object.entries(this.draft)
      .filter(([tool, slot]) => this.toolMap[Number(tool)] !== slot && this.slots.some(s => s.index === slot))
      .map(([tool, slot]) => `SAVE_VARIABLE VARIABLE=value_t${tool} VALUE="'slot${slot}'"`)
      .join('\n')

    if (script) this.sendGcode(script)

    this.open = false
  }
}
</script>

<style scoped>
.qidi-box-tool-map-dialog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px 16px;
}

.qidi-box-tool-map-dialog__row {
  gap: 8px;
}

.qidi-box-tool-map-dialog__tool {
  min-width: 32px;
}

.qidi-box-swatch {
  display: inline-block;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(128, 128, 128, 0.6);
}
</style>
