<template>
  <v-sheet
    outlined
    rounded
    class="px-3 py-2"
  >
    <div class="tltg-obico__row">
      <span class="secondary--text">{{ $t('app.tltg_addons.label.service') }}</span>
      <span :class="`${serviceColor}--text`">{{ serviceText }}</span>
    </div>

    <template v-if="status">
      <div class="tltg-obico__row">
        <span class="secondary--text">{{ $t('app.tltg_addons.label.server') }}</span>
        <span class="d-inline-flex align-center text-right">
          <span class="text-break">{{ cloud ? $t('app.tltg_addons.label.obico_cloud') : server }}</span>
          <app-btn
            small
            text
            color="primary"
            class="ml-1"
            :disabled="disabled"
            @click="openServerDialog"
          >
            {{ $t('app.tltg_addons.btn.change') }}
          </app-btn>
        </span>
      </div>

      <div class="tltg-obico__row">
        <span class="secondary--text">{{ $t('app.tltg_addons.label.account') }}</span>
        <span
          v-if="linked"
          class="d-inline-flex align-center"
        >
          <v-chip
            small
            outlined
            color="success"
          >
            {{ $t('app.tltg_addons.label.linked') }}
          </v-chip>
          <a
            v-if="serverUrl"
            :href="serverUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-2"
          >
            {{ $t('app.tltg_addons.btn.open_obico') }}
            <v-icon
              small
              color="primary"
            >
              $openInNew
            </v-icon>
          </a>
        </span>
        <span
          v-else
          class="warning--text"
        >
          {{ $t('app.tltg_addons.label.not_linked') }}
        </span>
      </div>

      <div
        v-if="linked"
        class="d-flex flex-wrap justify-end mt-1"
      >
        <app-btn
          small
          outlined
          color="error"
          class="ml-2 my-1"
          :disabled="disabled"
          @click="unlink"
        >
          {{ $t('app.tltg_addons.btn.unlink') }}
        </app-btn>
      </div>

      <template v-else-if="discovering">
        <div
          v-if="linkCode"
          class="mt-2"
        >
          <div class="text-center text-h4 font-weight-medium tltg-obico__code">
            {{ linkCode }}
          </div>
          <div class="text-body-2 mt-2">
            {{ $t(cloud ? 'app.tltg_addons.msg.obico_link_intro_cloud' : 'app.tltg_addons.msg.obico_link_intro_server') }}
          </div>
          <ol class="text-body-2">
            <li>{{ $t('app.tltg_addons.msg.obico_link_step_device') }}</li>
            <li>{{ $t('app.tltg_addons.msg.obico_link_step_manual') }}</li>
            <li>{{ $t('app.tltg_addons.msg.obico_link_step_code') }}</li>
          </ol>
        </div>
        <div
          v-else
          class="text-body-2 secondary--text mt-1"
        >
          {{ $t('app.tltg_addons.msg.obico_code_waiting') }}
        </div>
      </template>

      <template v-else>
        <div class="text-body-2 secondary--text mt-1">
          {{ $t('app.tltg_addons.msg.obico_not_waiting') }}
        </div>

        <div class="d-flex flex-wrap justify-end mt-1">
          <app-btn
            small
            color="primary"
            class="ml-2 my-1"
            :disabled="disabled"
            @click="emitAction({ action: 'relink' })"
          >
            {{ $t('app.tltg_addons.btn.restart_linking') }}
          </app-btn>
        </div>
      </template>
    </template>

    <app-dialog
      v-model="serverDialog"
      :title="$t('app.tltg_addons.title.obico_server')"
      :save-button-text="$t('app.tltg_addons.btn.use_server')"
      max-width="500"
      @save="saveServer"
    >
      <v-card-text>
        <p class="text-body-2">
          {{ $t('app.tltg_addons.msg.obico_server_relinks') }}
        </p>

        <v-radio-group
          v-model="serverChoice"
          hide-details
          class="mt-0"
        >
          <v-radio
            value="cloud"
            :label="$t('app.tltg_addons.label.obico_cloud')"
          />
          <v-radio
            value="self_hosted"
            :label="$t('app.tltg_addons.label.obico_self_hosted')"
          />
        </v-radio-group>

        <v-text-field
          v-if="serverChoice === 'self_hosted'"
          v-model="serverInput"
          filled
          dense
          autofocus
          class="mt-4"
          placeholder="http://192.168.1.10:3334"
          hide-details="auto"
          :rules="[
            $rules.required,
            serverRule
          ]"
        />
      </v-card-text>
    </app-dialog>
  </v-sheet>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { tltgServerUrlValid, TLTG_OBICO_CLOUD, type TltgAddon, type TltgAddonPanelAction } from '@/util/tltg-addons'

@Component({})
export default class TltgObicoStatus extends Vue {
  @Prop({ type: Object, required: true })
  readonly addon!: TltgAddon

  @Prop({ type: Function, required: true })
  readonly request!: (path: string, method?: 'GET' | 'POST') => Promise<unknown>

  @Prop({ type: Boolean, default: false })
  readonly disabled!: boolean

  serverDialog = false
  serverChoice: 'cloud' | 'self_hosted' = 'cloud'
  serverInput = ''

  get status (): Record<string, unknown> | null {
    return this.addon.status
  }

  get server (): string {
    const server = this.status?.server

    return typeof server === 'string' ? server : ''
  }

  get serverUrl (): string {
    return tltgServerUrlValid(this.server) ? this.server : ''
  }

  get cloud (): boolean {
    return this.status?.cloud === true
  }

  get linked (): boolean {
    return this.status?.linked === true
  }

  get discovering (): boolean {
    return this.status?.discovering === true
  }

  get linkCode (): string {
    const code = this.status?.link_code

    return typeof code === 'string' ? code : ''
  }

  get serviceState (): string {
    return this.addon.service?.active ?? 'unknown'
  }

  get serviceText (): string {
    const key = `app.tltg_addons.service.${this.serviceState}`

    return this.$te(key)
      ? this.$t(key).toString()
      : this.serviceState
  }

  get serviceColor (): string {
    switch (this.serviceState) {
      case 'active':
        return 'success'
      case 'failed':
        return 'error'
      case 'activating':
        return 'info'
      default:
        return 'warning'
    }
  }

  serverRule (value: string): boolean | string {
    return tltgServerUrlValid(value) || this.$t('app.tltg_addons.msg.obico_server_invalid').toString()
  }

  emitAction (request: TltgAddonPanelAction) {
    this.$emit('action', request)
  }

  openServerDialog () {
    this.serverChoice = this.cloud ? 'cloud' : 'self_hosted'
    this.serverInput = this.cloud ? '' : this.server
    this.serverDialog = true
  }

  saveServer () {
    const server = this.serverChoice === 'cloud' ? TLTG_OBICO_CLOUD : this.serverInput.trim()

    this.serverDialog = false
    this.emitAction({ action: 'relink', body: { server } })
  }

  async unlink () {
    const confirmed = await this.$confirm(
      this.$t('app.tltg_addons.msg.obico_confirm_unlink').toString(),
      { title: this.$t('app.tltg_addons.title.obico_unlink').toString(), color: 'card-heading', icon: '$error' }
    )

    if (confirmed) {
      this.emitAction({ action: 'relink' })
    }
  }
}
</script>

<style lang="scss" scoped>
  .tltg-obico__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 28px;
    column-gap: 16px;
  }

  .tltg-obico__code {
    font-family: 'Roboto Mono', monospace !important;
    letter-spacing: 0.2em !important;
  }
</style>
