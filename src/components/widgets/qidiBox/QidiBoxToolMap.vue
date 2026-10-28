<template>
  <!-- One diagram per Box, plus the external spool, for each that has tools mapped to it. A tool maps to a single
       slot, so lines never cross between Boxes. -->
  <div class="text-center pt-2">
    <div class="d-flex flex-wrap justify-center qidi-box-tool-map__groups">
      <svg
        v-for="group in groups"
        :key="group.slots[0]"
        class="rounded-lg qidi-box-tool-map__group"
        :viewBox="`0 0 ${group.width + 8} 104`"
        :width="group.width + 8"
        height="104"
      >
        <g transform="translate(4 2)">
          <path
            v-for="(entry, i) in group.tools"
            :key="`line-${entry.tool}`"
            :d="`M${toolX(group, i)} 22 C${toolX(group, i)} 50 ${slotX(group, entry.slot)} 50 ${slotX(group, entry.slot)} 78`"
            fill="none"
            :stroke-width="entry.slot === loadedSlot ? 3 : 2"
            :stroke="lineColor(entry.slot)"
          />
          <g
            v-for="(entry, i) in group.tools"
            :key="`tool-${entry.tool}`"
            class="qidi-box-tool-map__chip"
            @click="$emit('tool-click', entry)"
          >
            <rect
              :x="toolX(group, i) - 15"
              y="4"
              width="30"
              height="18"
              rx="4"
              :fill="entry.slot === loadedSlot ? '#2196f3' : 'rgba(128,128,128,0.25)'"
              stroke="rgba(128,128,128,0.6)"
            />
            <text
              :x="toolX(group, i)"
              y="17"
              text-anchor="middle"
              font-size="10"
              font-weight="700"
              :fill="entry.slot === loadedSlot ? '#FFFFFF' : 'currentColor'"
            >T{{ entry.tool }}</text>
          </g>
          <g
            v-for="index in group.slots"
            :key="`slot-${index}`"
            class="qidi-box-tool-map__chip"
            @click="$emit('select', index)"
          >
            <rect
              :x="slotX(group, index) - 15"
              y="78"
              width="30"
              height="18"
              rx="4"
              :fill="slotFill(index)"
              :stroke="slotRing(index) || 'rgba(128,128,128,0.6)'"
              :stroke-width="slotRing(index) ? 2 : 1"
            />
            <text
              :x="slotX(group, index)"
              y="91"
              text-anchor="middle"
              font-size="10"
              font-weight="700"
              :fill="slotTextColor(index)"
            >{{ slotByIndex[index].label }}</text>
          </g>
        </g>
      </svg>
    </div>
    <div class="d-flex align-center justify-center mt-1 qidi-box-tool-map__footer">
      <span class="text-caption text--disabled">{{ $t('app.qidi_box.title.tool_mapping') }}</span>
      <app-btn
        x-small
        text
        color="primary"
        :disabled="locked"
        @click="$emit('edit')"
      >
        <v-icon
          x-small
          left
        >
          $pencil
        </v-icon>
        {{ $t('app.qidi_box.btn.edit') }}
      </app-btn>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { QIDI_BOX_EXTERNAL_SLOT, qidiTextColor, type QidiBoxSlot } from '@/util/qidi-box'

const STEP = 36

interface ToolMapGroup {
  slots: number[];
  tools: { tool: number, slot: number }[];
  width: number;
}

@Component({})
export default class QidiBoxToolMap extends Vue {
  @Prop({ type: Array, required: true })
  readonly slots!: QidiBoxSlot[]

  @Prop({ type: Object, required: true })
  readonly toolMap!: Record<number, number>

  @Prop({ type: Number, required: true })
  readonly selected!: number

  @Prop({ type: Number, default: null })
  readonly loadedSlot!: number | null

  @Prop({ type: Boolean })
  readonly locked!: boolean

  get slotByIndex (): Record<number, QidiBoxSlot> {
    return Object.fromEntries(this.slots.map(slot => [slot.index, slot]))
  }

  get groups (): ToolMapGroup[] {
    const boxes = new Map<number, number[]>()

    for (const slot of this.slots) {
      const key = slot.index === QIDI_BOX_EXTERNAL_SLOT ? QIDI_BOX_EXTERNAL_SLOT : Math.floor(slot.index / 4)

      boxes.set(key, [...(boxes.get(key) ?? []), slot.index])
    }

    const entries = Object.entries(this.toolMap).map(([tool, slot]) => ({ tool: Number(tool), slot }))

    return Array.from(boxes.values())
      .map(slots => {
        const tools = entries.filter(entry => slots.includes(entry.slot))

        return { slots, tools, width: Math.max(tools.length, slots.length) * STEP }
      })
      .filter(group => group.tools.length > 0)
  }

  toolX (group: ToolMapGroup, i: number) {
    return (group.width - group.tools.length * STEP) / 2 + STEP / 2 + i * STEP
  }

  slotX (group: ToolMapGroup, index: number) {
    return (group.width - group.slots.length * STEP) / 2 + STEP / 2 + group.slots.indexOf(index) * STEP
  }

  lineColor (index: number) {
    const slot = this.slotByIndex[index]

    if (index === this.loadedSlot) return '#2196f3'

    return slot?.present && slot.color ? slot.color : 'rgba(128,128,128,0.8)'
  }

  slotFill (index: number) {
    const slot = this.slotByIndex[index]

    return slot.present && slot.color ? slot.color : 'rgba(128,128,128,0.15)'
  }

  slotTextColor (index: number) {
    const slot = this.slotByIndex[index]

    return slot.present && slot.color ? qidiTextColor(slot.color) : 'currentColor'
  }

  slotRing (index: number) {
    if (index === this.loadedSlot) return '#2196f3'
    if (index === this.selected) return 'currentColor'

    return null
  }
}
</script>

<style scoped>
.qidi-box-tool-map__groups {
  gap: 12px;
}

.qidi-box-tool-map__group {
  background: rgba(128, 128, 128, 0.08);
}

.qidi-box-tool-map__chip {
  cursor: pointer;
}

.qidi-box-tool-map__footer {
  gap: 8px;
}
</style>
