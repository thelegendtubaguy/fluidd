<template>
  <collapsable-card
    :title="$t('app.qidi_filaments.title.filaments')"
    icon="$filament"
    :collapsable="false"
    :loading="loading"
  >
    <template #menu>
      <app-btn-collapse-group :collapsed="isMobileViewport">
        <app-btn
          small
          class="ms-1 my-1"
          :disabled="config == null || busy"
          @click="handleAdd"
        >
          <v-icon
            small
            left
          >
            $plus
          </v-icon>
          <span>{{ $t('app.qidi_filaments.btn.add') }}</span>
        </app-btn>
        <app-btn
          small
          class="ms-1 my-1"
          :disabled="config == null || busy"
          @click="importFile.click()"
        >
          <v-icon
            small
            left
          >
            $fileUpload
          </v-icon>
          <span>{{ $t('app.qidi_filaments.btn.import') }}</span>
        </app-btn>
        <app-btn
          small
          class="ms-1 my-1"
          :disabled="config == null || busy"
          @click="handleExport"
        >
          <v-icon
            small
            left
          >
            $fileExport
          </v-icon>
          <span>{{ $t('app.qidi_filaments.btn.export') }}</span>
        </app-btn>
        <app-btn
          small
          class="ms-1 my-1"
          :disabled="busy"
          @click="load"
        >
          <v-icon
            small
            left
          >
            $refresh
          </v-icon>
          <span>{{ $t('app.general.btn.refresh') }}</span>
        </app-btn>
      </app-btn-collapse-group>
    </template>

    <v-alert
      v-if="restartNeeded"
      type="info"
      text
      dense
      class="ma-2"
    >
      <div class="d-flex flex-wrap align-center">
        <span class="me-2">
          {{ $t('app.qidi_filaments.msg.restart_needed') }}
        </span>
        <v-spacer />
        <app-btn
          small
          color="primary"
          :disabled="printerBusy"
          @click="handleRestart"
        >
          {{ canRestartTouchscreen ? $t('app.qidi_filaments.btn.restart') : $t('app.qidi_filaments.btn.restart_klipper') }}
        </app-btn>
      </div>
    </v-alert>

    <v-alert
      v-if="loadError"
      type="error"
      text
      dense
      class="ma-2"
    >
      {{ loadError === 'invalid' ? $t('app.qidi_filaments.msg.invalid') : $t('app.qidi_filaments.msg.unavailable') }}
    </v-alert>

    <v-alert
      type="warning"
      text
      dense
      class="ma-2"
    >
      {{ $t('app.qidi_filaments.msg.firmware_update') }}
    </v-alert>

    <v-toolbar
      dense
      flat
    >
      <v-select
        v-model="vendor"
        :items="vendors"
        :label="$t('app.qidi_filaments.label.vendor')"
        style="max-width: 200px;"
        clearable
        outlined
        dense
        hide-details
      />
      <v-spacer />
      <div style="max-width: 200px;">
        <v-text-field
          v-model="search"
          outlined
          dense
          single-line
          hide-details
          spellcheck="false"
          append-icon="$magnify"
        />
      </div>
    </v-toolbar>

    <v-data-table
      :items="filteredRows"
      :headers="headers"
      :search="search"
      :items-per-page="-1"
      hide-default-footer
      mobile-breakpoint="0"
      item-key="key"
    >
      <template #[`item.nozzleMin`]="{ item }">
        {{ item.nozzleMin }}–{{ item.nozzleMax }} °C
      </template>

      <template #[`item.boxMax`]="{ item }">
        <span v-if="item.boxMax">{{ item.boxMax }} °C</span>
        <span
          v-else
          class="text--secondary"
        >{{ $t('app.qidi_filaments.label.no_heating') }}</span>
      </template>

      <template #[`item.chamber`]="{ item }">
        <span v-if="item.chamber">{{ item.chamber }} °C</span>
        <span
          v-else
          class="text--secondary"
        >–</span>
      </template>

      <template #[`item.support`]="{ item }">
        <v-icon
          v-if="item.support"
          small
        >
          $check
        </v-icon>
      </template>

      <template #[`item.actions`]="{ item }">
        <div class="text-no-wrap">
          <app-btn
            icon
            small
            :title="$t('app.general.btn.edit')"
            :disabled="busy"
            @click="handleEdit(item)"
          >
            <v-icon small>
              $pencil
            </v-icon>
          </app-btn>
          <app-btn
            icon
            small
            :title="$t('app.qidi_filaments.btn.duplicate')"
            :disabled="busy"
            @click="handleDuplicate(item)"
          >
            <v-icon small>
              $duplicate
            </v-icon>
          </app-btn>
          <app-btn
            icon
            small
            :title="$t('app.general.btn.remove')"
            :disabled="busy"
            @click="handleRemove(item)"
          >
            <v-icon small>
              $delete
            </v-icon>
          </app-btn>
        </div>
      </template>
    </v-data-table>

    <qidi-filament-dialog
      v-if="config != null && editor != null"
      v-model="editor.open"
      :config="config"
      :initial-draft="editor.draft"
      :previous-key="editor.previousKey"
      :source-key="editor.sourceKey"
      :busy="busy"
      @save="handleSave"
    />

    <qidi-filament-import-dialog
      v-if="imported != null"
      v-model="imported.open"
      :items="imported.items"
      :busy="busy"
      @save="handleImport"
    />

    <input
      ref="importFile"
      type="file"
      :accept="isIOS ? undefined : '.json'"
      style="display: none"
      @change="handleImportFile"
    >
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins, Ref } from 'vue-property-decorator'
import { consola } from 'consola'
import StateMixin from '@/mixins/state'
import FilesMixin from '@/mixins/files'
import ServicesMixin from '@/mixins/services'
import BrowserMixin from '@/mixins/browser'
import { EventBus } from '@/eventBus'
import downloadUrl from '@/util/download-url'
import { readFileAsTextAsync } from '@/util/file-system-entry'
import type { QidiBoxSlot } from '@/util/qidi-box'
import {
  QIDI_FILAMENT_CONFIG_FILE,
  QIDI_FILAMENT_CONFIG_FILENAME,
  QIDI_FILAMENT_CONFIG_PATH,
  applyQidiFilamentImport,
  diffQidiFilamentImport,
  nextQidiFilamentId,
  parseQidiFilamentConfig,
  qidiFilamentBaseKey,
  qidiFilamentRows,
  removeQidiFilament,
  serializeQidiFilamentConfig,
  setQidiFilament,
  type QidiFilamentConfig,
  type QidiFilamentDraft,
  type QidiFilamentImportItem,
  type QidiFilamentRow
} from '@/util/qidi-filament-config'
import QidiFilamentDialog, { type QidiFilamentDialogSave } from './QidiFilamentDialog.vue'
import QidiFilamentImportDialog from './QidiFilamentImportDialog.vue'

const QIDI_CLIENT_SERVICE = 'qidi-client'

class InvalidFilamentConfigError extends Error {}

interface EditorState {
  open: boolean;
  draft: QidiFilamentDraft;
  previousKey?: string;
  sourceKey?: string;
}

interface ImportState {
  open: boolean;
  config: QidiFilamentConfig;
  items: QidiFilamentImportItem[];
}

// Edits QIDI's filament database. Each change rereads the file and writes it back whole, so an edit made
// elsewhere in the meantime, such as in the config editor, is kept.
@Component({
  components: {
    QidiFilamentDialog,
    QidiFilamentImportDialog
  }
})
export default class QidiFilamentsCard extends Mixins(StateMixin, FilesMixin, ServicesMixin, BrowserMixin) {
  @Ref('importFile')
  readonly importFile!: HTMLInputElement

  config: QidiFilamentConfig | null = null
  loading = false
  busy = false
  loadError: 'invalid' | 'unavailable' | null = null
  restartNeeded = false
  search = ''
  vendor: string | null = null
  editor: EditorState | null = null
  imported: ImportState | null = null

  mounted () {
    this.load()
  }

  get headers () {
    return [
      { text: this.$t('app.qidi_filaments.label.vendor'), value: 'vendor' },
      { text: this.$t('app.qidi_filaments.label.filament'), value: 'name' },
      { text: this.$t('app.qidi_filaments.label.type'), value: 'type' },
      { text: this.$t('app.qidi_filaments.label.filament_id'), value: 'id' },
      { text: this.$t('app.qidi_filaments.label.nozzle'), value: 'nozzleMin', filterable: false },
      { text: this.$t('app.qidi_filaments.label.box_max'), value: 'boxMax', filterable: false },
      { text: this.$t('app.qidi_filaments.label.chamber'), value: 'chamber', filterable: false },
      { text: this.$t('app.qidi_filaments.label.support'), value: 'support', filterable: false },
      { text: '', value: 'actions', align: 'end', sortable: false, filterable: false }
    ]
  }

  get rows (): QidiFilamentRow[] {
    return this.config ? qidiFilamentRows(this.config) : []
  }

  get filteredRows (): QidiFilamentRow[] {
    return this.vendor ? this.rows.filter(row => row.vendor === this.vendor) : this.rows
  }

  get vendors (): string[] {
    return [...new Set(this.rows.map(row => row.vendor))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }

  get canRestartTouchscreen (): boolean {
    return this.$typedState.server.system_info?.available_services?.includes(QIDI_CLIENT_SERVICE) ?? false
  }

  async readConfig (): Promise<QidiFilamentConfig> {
    const response = await this.serverFilesGet<string>(`config/${QIDI_FILAMENT_CONFIG_FILE}`, {
      responseType: 'text',
      transformResponse: [(value: string) => value]
    })
    const config = parseQidiFilamentConfig(response.data)

    if (config == null) throw new InvalidFilamentConfigError()

    return config
  }

  async load () {
    this.loading = true

    try {
      this.config = await this.readConfig()
      this.loadError = null
    } catch (error) {
      consola.error('[QidiFilaments] read failed', error)

      this.config = null
      this.loadError = error instanceof InvalidFilamentConfigError ? 'invalid' : 'unavailable'
    } finally {
      this.loading = false
    }
  }

  async update (change: (config: QidiFilamentConfig) => QidiFilamentConfig): Promise<boolean> {
    this.busy = true

    try {
      const config = change(await this.readConfig())
      const file = new File([serializeQidiFilamentConfig(config)], QIDI_FILAMENT_CONFIG_FILENAME, { type: 'application/json' })

      await this.uploadFile(file, QIDI_FILAMENT_CONFIG_PATH, 'config', false)

      this.config = config
      this.restartNeeded = true

      return true
    } catch (error) {
      consola.error('[QidiFilaments] save failed', error)

      const message = error instanceof InvalidFilamentConfigError
        ? this.$t('app.qidi_filaments.msg.invalid')
        : this.$t('app.qidi_filaments.msg.save_failed', { error: error instanceof Error ? error.message : String(error) })

      EventBus.$emit(message.toString(), { type: 'error' })

      return false
    } finally {
      this.busy = false
    }
  }

  openEditor (draft: QidiFilamentDraft, keys: { previousKey?: string, sourceKey?: string } = {}) {
    this.editor = { open: true, draft, ...keys }
  }

  handleAdd () {
    if (this.config == null) return

    const baseKey = qidiFilamentBaseKey(this.config, 'PLA')
    const base = baseKey != null ? this.rows.find(row => row.key === baseKey) : undefined

    this.openEditor({
      vendor: '',
      name: '',
      id: (base && nextQidiFilamentId(this.config, base.id)) ?? '',
      type: base?.type ?? '',
      nozzleMin: base?.nozzleMin ?? null,
      nozzleMax: base?.nozzleMax ?? null,
      boxMax: base?.boxMax ?? 0,
      chamber: base?.chamber ?? 0,
      support: false
    })
  }

  handleEdit (row: QidiFilamentRow) {
    const { key, ...draft } = row

    this.openEditor(draft, { previousKey: key })
  }

  handleDuplicate (row: QidiFilamentRow) {
    if (this.config == null) return

    const { key, ...draft } = row

    this.openEditor({
      ...draft,
      name: `${draft.name} (${this.$t('app.qidi_filaments.label.copy')})`,
      id: nextQidiFilamentId(this.config, row.id) ?? ''
    }, { sourceKey: key })
  }

  async handleSave ({ draft, previousKey, baseKey }: QidiFilamentDialogSave) {
    if (await this.update(config => setQidiFilament(config, draft, { previousKey, baseKey })) && this.editor) {
      this.editor.open = false
    }
  }

  async handleRemove (row: QidiFilamentRow) {
    const slots = (this.$typedGetters['qidiBox/getSlots'] as QidiBoxSlot[])
      .filter(slot => slot.filamentId === row.id)
      .map(slot => slot.label)
    const message = [
      this.$t('app.qidi_filaments.msg.confirm_remove', { name: row.key }),
      ...(slots.length ? [this.$t('app.qidi_filaments.msg.remove_in_use', { slots: slots.join(', ') })] : [])
    ].join(' ')

    const result = await this.$confirm(message, {
      title: this.$tc('app.general.label.confirm'),
      color: 'card-heading',
      icon: '$error'
    })

    if (result) {
      await this.update(config => removeQidiFilament(config, row.key))
    }
  }

  async handleExport () {
    try {
      const text = serializeQidiFilamentConfig(await this.readConfig())
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const instanceName = this.$typedState.config.uiSettings.general.instanceName

      downloadUrl(`qidi-filaments-${instanceName}.json`, url)

      // Deferred, as revoking right after the click can cancel the download
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      consola.error('[QidiFilaments] export failed', error)

      EventBus.$emit(this.$t('app.qidi_filaments.msg.export_failed').toString(), { type: 'error' })
    }
  }

  async handleImportFile () {
    const file = this.importFile.files?.[0]

    this.importFile.value = ''

    if (file == null) return

    try {
      const config = parseQidiFilamentConfig(await readFileAsTextAsync(file))

      if (config == null) {
        EventBus.$emit(this.$t('app.qidi_filaments.msg.import_invalid').toString(), { type: 'error' })

        return
      }

      this.imported = {
        open: true,
        config,
        items: diffQidiFilamentImport(await this.readConfig(), config)
      }
    } catch (error) {
      consola.error('[QidiFilaments] import failed', error)

      EventBus.$emit(this.$t('app.qidi_filaments.msg.unavailable').toString(), { type: 'error' })
    }
  }

  async handleImport (keys: string[]) {
    const imported = this.imported

    if (imported == null) return

    if (await this.update(config => applyQidiFilamentImport(config, imported.config, keys))) {
      imported.open = false
    }
  }

  // Klipper and the touchscreen read the filament list only when they start.
  async handleRestart () {
    if (this.canRestartTouchscreen) {
      this.serviceRestartByName(QIDI_CLIENT_SERVICE)
    }

    await this.serviceRestartKlipper()

    this.restartNeeded = false
  }
}
</script>
