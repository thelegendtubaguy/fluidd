<template>
  <div v-if="lanOnly != null">
    <v-divider />

    <app-setting
      :title="$t('app.tltg_valve_oil.label.lan_only')"
      :sub-title="$t('app.tltg_valve_oil.msg.lan_only')"
      :r-cols="5"
    >
      <v-switch
        :input-value="switchValue"
        :loading="request != null"
        :disabled="request != null"
        hide-details
        class="mt-0 pt-0 float-right"
        @change="setLanOnly"
      />
    </app-setting>

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
        @input="error = ''"
      >
        {{ $t('app.tltg_valve_oil.msg.lan_only_failed', { error }) }}
      </v-alert>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import { SocketActions } from '@/api/socketActions'
import {
  QIDI_LAN_MODE_KEY,
  QIDI_LAN_MODE_SECTION,
  qidiLanModeFromConfig,
  qidiLanModeValue
} from '@/util/qidi-lan-mode'

/**
 * QIDI's LAN-only mode, the same setting as the touchscreen's LAN Only switch. Shown only when the printer's Moonraker
 * has QIDI's settings table.
 */
@Component({})
export default class TltgQidiLanOnly extends Vue {
  lanOnly: boolean | null = null
  request: boolean | null = null
  error = ''

  get switchValue (): boolean {
    return this.request ?? this.lanOnly === true
  }

  get socketReady (): boolean {
    return this.$typedGetters['socket/getIsReady']
  }

  mounted () {
    document.addEventListener('visibilitychange', this.onVisibility)
    this.load()
  }

  beforeDestroy () {
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  @Watch('socketReady')
  onSocketReady (ready: boolean) {
    if (ready) {
      this.load()
    }
  }

  onVisibility () {
    // The touchscreen can change it too.
    if (!document.hidden) {
      this.load()
    }
  }

  async load () {
    if (!this.socketReady || this.request != null) {
      return
    }

    try {
      const response = await SocketActions.serverDatabaseConfigSelect(QIDI_LAN_MODE_SECTION, QIDI_LAN_MODE_KEY, qidiLanModeValue(false))

      if (this.request == null) {
        this.lanOnly = qidiLanModeFromConfig(response)
      }
    } catch {
      // Upstream Moonraker has no settings table, so there's no switch to show.
      this.lanOnly = null
    }
  }

  async setLanOnly (value: boolean | null) {
    const on = value === true

    if (this.request != null || on === this.lanOnly) {
      return
    }

    this.request = on
    this.error = ''

    try {
      const response = await SocketActions.serverDatabaseConfigUpdate(QIDI_LAN_MODE_SECTION, QIDI_LAN_MODE_KEY, qidiLanModeValue(on))

      if (qidiLanModeFromConfig(response) == null) {
        throw new Error(response.message ?? response.status)
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    } finally {
      this.request = null
    }

    this.load()
  }
}
</script>
