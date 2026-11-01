<template>
  <app-dialog
    v-model="open"
    :title="$t('app.qidi_filaments.title.import')"
    width="520"
    :save-button-text="$t('app.qidi_filaments.btn.import')"
    :save-button-disabled="selected.length === 0"
    :save-button-loading="busy"
    @save="$emit('save', selected)"
  >
    <v-card-text class="pt-4">
      <template v-if="items.length">
        <p>{{ $t('app.qidi_filaments.msg.import_choose') }}</p>

        <v-checkbox
          v-for="item in items"
          :key="item.key"
          :input-value="selected"
          :value="item.key"
          :disabled="item.status === 'conflict'"
          class="mt-0"
          hide-details="auto"
          :hint="statusText(item)"
          persistent-hint
          @change="selected = $event"
        >
          <template #label>
            {{ item.key }}
            <span class="text--secondary ms-2">{{ item.id }}</span>
          </template>
        </v-checkbox>
      </template>
      <p v-else>
        {{ $t('app.qidi_filaments.msg.import_nothing') }}
      </p>
    </v-card-text>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Prop, VModel, Vue, Watch } from 'vue-property-decorator'
import type { QidiFilamentImportItem } from '@/util/qidi-filament-config'

// New filaments start selected. Changed ones do not, as after a firmware update the change may be QIDI's.
@Component({})
export default class QidiFilamentImportDialog extends Vue {
  @VModel({ type: Boolean })
  open!: boolean

  @Prop({ type: Array, required: true })
  readonly items!: QidiFilamentImportItem[]

  @Prop({ type: Boolean })
  readonly busy!: boolean

  selected: string[] = []

  @Watch('items', { immediate: true })
  onItems () {
    this.selected = this.items
      .filter(item => item.status === 'new')
      .map(item => item.key)
  }

  statusText (item: QidiFilamentImportItem): string {
    switch (item.status) {
      case 'new':
        return this.$t('app.qidi_filaments.msg.import_new').toString()
      case 'changed':
        return this.$t('app.qidi_filaments.msg.import_changed').toString()
      case 'conflict':
        return this.$t('app.qidi_filaments.msg.import_conflict', { id: item.id, name: item.conflictKey }).toString()
    }
  }
}
</script>
