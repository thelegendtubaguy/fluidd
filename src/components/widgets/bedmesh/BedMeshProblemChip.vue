<template>
  <v-chip
    small
    v-bind="$attrs"
  >
    <v-icon
      small
      left
      :color="warningColor"
    >
      $warning
    </v-icon>
    {{ $tc('app.bed_soak.label.problem_points_count', count, { count }) }}
  </v-chip>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { BedSoakColors } from '@/util/tltg-bed-soak'

@Component({
  inheritAttrs: false
})
export default class BedMeshProblemChip extends Vue {
  @Prop({ type: Number, required: true })
  readonly count!: number

  readonly warningColor = BedSoakColors.warning
}
</script>
