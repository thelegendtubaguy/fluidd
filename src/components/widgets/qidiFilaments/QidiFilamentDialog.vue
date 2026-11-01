<template>
  <app-dialog
    v-model="open"
    :title="previousKey != null ? $t('app.qidi_filaments.title.edit_filament') : $t('app.qidi_filaments.title.add_filament')"
    width="480"
    :save-button-loading="busy"
    @save="handleSave"
  >
    <v-card-text class="pt-4">
      <v-row>
        <v-col
          cols="12"
          sm="6"
        >
          <v-combobox
            :value="draft.vendor"
            :items="vendors"
            :label="$t('app.qidi_filaments.label.vendor')"
            :rules="[$rules.required]"
            hide-details="auto"
            outlined
            dense
            @change="draft.vendor = $event ?? ''"
            @update:search-input="$event != null && (draft.vendor = $event)"
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
        >
          <v-text-field
            v-model="draft.name"
            :label="$t('app.qidi_filaments.label.filament')"
            :rules="[$rules.required, nameAvailable]"
            hide-details="auto"
            spellcheck="false"
            outlined
            dense
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
        >
          <v-combobox
            :value="draft.type"
            :items="types"
            :label="$t('app.qidi_filaments.label.type')"
            :rules="[$rules.required]"
            hide-details="auto"
            outlined
            dense
            @change="draft.type = $event ?? ''"
            @update:search-input="$event != null && (draft.type = $event)"
          />
        </v-col>
        <v-col
          cols="12"
          sm="6"
        >
          <v-text-field
            v-model="draft.id"
            :label="$t('app.qidi_filaments.label.filament_id')"
            :rules="[$rules.required, idValid, idAvailable]"
            :disabled="previousKey != null"
            :hint="previousKey != null ? $t('app.qidi_filaments.hint.filament_id_fixed') : undefined"
            persistent-hint
            hide-details="auto"
            spellcheck="false"
            outlined
            dense
          />
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model.number="draft.nozzleMin"
            type="number"
            :label="$t('app.qidi_filaments.label.nozzle_min')"
            :rules="[$rules.required, $rules.numberValid, $rules.numberGreaterThan(0)]"
            suffix="°C"
            hide-details="auto"
            outlined
            dense
          />
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model.number="draft.nozzleMax"
            type="number"
            :label="$t('app.qidi_filaments.label.nozzle_max')"
            :rules="[$rules.required, $rules.numberValid, $rules.numberGreaterThanOrEqual(draft.nozzleMin ?? 0)]"
            suffix="°C"
            hide-details="auto"
            outlined
            dense
          />
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model.number="draft.boxMax"
            type="number"
            :label="$t('app.qidi_filaments.label.box_max')"
            :rules="[$rules.required, $rules.numberValid, $rules.numberGreaterThanOrEqual(0)]"
            :hint="$t('app.qidi_filaments.hint.box_max')"
            suffix="°C"
            hide-details="auto"
            outlined
            dense
          />
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model.number="draft.chamber"
            type="number"
            :label="$t('app.qidi_filaments.label.chamber')"
            :rules="[$rules.required, $rules.numberValid, $rules.numberGreaterThanOrEqual(0)]"
            suffix="°C"
            hide-details="auto"
            outlined
            dense
          />
        </v-col>
        <v-col cols="12">
          <v-checkbox
            v-model="draft.support"
            :label="$t('app.qidi_filaments.label.support_material')"
            hide-details
            class="mt-0"
          />
        </v-col>
      </v-row>

      <div class="text-caption text--secondary mt-4">
        {{ $t('app.qidi_filaments.msg.saved_as', { name: key }) }}
        <template v-if="baseKey != null">
          {{ $t('app.qidi_filaments.msg.copied_from', { name: baseKey }) }}
        </template>
      </div>
    </v-card-text>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Prop, VModel, Vue, Watch } from 'vue-property-decorator'
import {
  QIDI_FILAMENT_ID_PATTERN,
  qidiFilamentBaseKey,
  qidiFilamentIdOwner,
  qidiFilamentKey,
  type QidiFilamentConfig,
  type QidiFilamentDraft
} from '@/util/qidi-filament-config'

export interface QidiFilamentDialogSave {
  draft: QidiFilamentDraft;
  previousKey?: string;
  baseKey?: string;
}

// Adds, duplicates, or edits a filament. A new filament copies the settings the dialog does not show, such as
// QIDI's drying presets, from the filament it duplicates, or else from a filament of the same type.
@Component({})
export default class QidiFilamentDialog extends Vue {
  @VModel({ type: Boolean })
  open!: boolean

  @Prop({ type: Object, required: true })
  readonly config!: QidiFilamentConfig

  @Prop({ type: Object, required: true })
  readonly initialDraft!: QidiFilamentDraft

  // The filament being edited; absent for a new filament.
  @Prop({ type: String })
  readonly previousKey?: string

  // The filament being duplicated.
  @Prop({ type: String })
  readonly sourceKey?: string

  @Prop({ type: Boolean })
  readonly busy!: boolean

  draft: QidiFilamentDraft = {
    vendor: '',
    name: '',
    id: '',
    type: '',
    nozzleMin: null,
    nozzleMax: null,
    boxMax: null,
    chamber: null,
    support: false
  }

  created () {
    this.draft = { ...this.initialDraft }
  }

  @Watch('open')
  onOpen (value: boolean) {
    if (value) this.draft = { ...this.initialDraft }
  }

  get vendors (): string[] {
    return [...new Set(Object.values(this.config).map(entry => String(entry.filament_vendor ?? '')))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }

  get types (): string[] {
    return [...new Set(Object.values(this.config).map(entry => String(entry.type ?? '')))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }

  get key (): string {
    return qidiFilamentKey(this.draft)
  }

  get baseKey (): string | undefined {
    if (this.previousKey != null) return undefined

    return this.sourceKey ?? qidiFilamentBaseKey(this.config, this.draft.type)
  }

  nameAvailable (): boolean | string {
    return this.key === this.previousKey || !(this.key in this.config) ||
      this.$t('app.qidi_filaments.msg.name_taken', { name: this.key }).toString()
  }

  idValid (value: string): boolean | string {
    return QIDI_FILAMENT_ID_PATTERN.test(value) || this.$t('app.qidi_filaments.msg.id_invalid').toString()
  }

  idAvailable (value: string): boolean | string {
    const owner = qidiFilamentIdOwner(this.config, value, this.previousKey)

    return owner == null || this.$t('app.qidi_filaments.msg.id_taken', { name: owner }).toString()
  }

  handleSave () {
    this.$emit('save', {
      draft: {
        ...this.draft,
        vendor: this.draft.vendor.trim(),
        name: this.draft.name.trim(),
        type: this.draft.type.trim()
      },
      previousKey: this.previousKey,
      baseKey: this.baseKey
    } satisfies QidiFilamentDialogSave)
  }
}
</script>
