<template>
  <v-sheet
    outlined
    rounded
    class="px-3 py-2"
  >
    <div class="tltg-zerotier__row">
      <span class="secondary--text">{{ $t('app.tltg_addons.label.service') }}</span>
      <span :class="`${serviceColor}--text`">{{ serviceText }}</span>
    </div>

    <div
      v-if="unavailable"
      class="text-body-2 secondary--text mt-1"
    >
      {{ unavailable }}
    </div>

    <template v-else-if="status">
      <div class="tltg-zerotier__row">
        <span class="secondary--text">{{ $t('app.tltg_addons.label.zerotier') }}</span>
        <span :class="`${status.online ? 'success' : 'warning'}--text`">
          {{ $t(status.online ? 'app.tltg_addons.label.online' : 'app.tltg_addons.label.offline') }}
        </span>
      </div>

      <div
        v-if="status.nodeId"
        class="tltg-zerotier__row"
      >
        <span class="secondary--text">{{ $t('app.tltg_addons.label.zerotier_node_id') }}</span>
        <span class="text-right">{{ status.nodeId }}</span>
      </div>

      <div
        v-if="status.networks.length === 0"
        class="text-body-2 mt-1"
      >
        {{ $t('app.tltg_addons.msg.zerotier_no_network') }}
      </div>

      <v-sheet
        v-for="network in status.networks"
        :key="network.id"
        outlined
        rounded
        class="px-3 py-2 mt-2"
      >
        <div class="tltg-zerotier__row">
          <span class="secondary--text">{{ $t('app.tltg_addons.label.zerotier_network') }}</span>
          <span class="text-break text-right">
            {{ network.name ? `${network.name} (${network.id})` : network.id }}
          </span>
        </div>

        <div class="tltg-zerotier__row">
          <span class="secondary--text">{{ $t('app.tltg_addons.label.zerotier_state') }}</span>
          <span :class="`${networkColor(network.state)}--text`">
            {{ $t(`app.tltg_addons.zerotier_state.${network.state}`) }}
          </span>
        </div>

        <div
          v-if="network.addresses.length > 0"
          class="tltg-zerotier__row"
        >
          <span class="secondary--text">{{ $t('app.tltg_addons.label.zerotier_address') }}</span>
          <span class="text-break text-right">
            <template v-for="(address, index) in network.addresses">
              <br
                v-if="index > 0"
                :key="`br-${address}`"
              >
              <a
                v-if="isIpv4(address)"
                :key="address"
                :href="`http://${address}/`"
                target="_blank"
                rel="noopener noreferrer"
              >{{ address }}</a>
              <span
                v-else
                :key="address"
              >{{ address }}</span>
            </template>
          </span>
        </div>

        <div
          v-if="networkMessage(network.state)"
          class="text-body-2 mt-1"
          :class="{ 'secondary--text': network.state === 'ok' }"
        >
          {{ networkMessage(network.state) }}
        </div>

        <div class="d-flex justify-end mt-1">
          <app-btn
            small
            outlined
            color="error"
            class="my-1"
            :disabled="working"
            @click="leave(network)"
          >
            {{ $t('app.tltg_addons.btn.zerotier_leave') }}
          </app-btn>
        </div>
      </v-sheet>

      <v-alert
        v-if="error"
        dense
        text
        type="error"
        class="mt-2 mb-0"
      >
        {{ error }}
      </v-alert>

      <div class="d-flex align-start mt-2">
        <v-text-field
          v-model="networkId"
          :label="$t('app.tltg_addons.label.zerotier_network_id')"
          :rules="[networkIdRule]"
          :hint="$t('app.tltg_addons.msg.zerotier_network_id')"
          placeholder="8056c2e21c000001"
          maxlength="16"
          autocomplete="off"
          spellcheck="false"
          dense
          outlined
          hide-details="auto"
          class="mr-2"
          @keyup.enter="join"
        />
        <app-btn
          small
          color="primary"
          class="mt-1"
          :loading="working"
          :disabled="!networkIdValid"
          @click="join"
        >
          {{ $t('app.tltg_addons.btn.zerotier_join') }}
        </app-btn>
      </div>
    </template>
  </v-sheet>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import {
  parseTltgZerotierStatus,
  tltgZerotierNetworkIdValid,
  type TltgAddon,
  type TltgZerotierNetwork,
  type TltgZerotierNetworkState,
  type TltgZerotierStatus as ZerotierStatus
} from '@/util/tltg-addons'

@Component({})
export default class TltgZerotierStatus extends Vue {
  @Prop({ type: Object, required: true })
  readonly addon!: TltgAddon

  @Prop({ type: Function, required: true })
  readonly request!: (path: string, method?: 'GET' | 'POST', signal?: AbortSignal, body?: Record<string, unknown>) => Promise<unknown>

  // What the last join or leave answered, shown until the add-ons list is read again.
  answered: ZerotierStatus | null = null
  working = false
  error = ''
  networkId = ''

  get status (): ZerotierStatus | null {
    return this.answered ?? parseTltgZerotierStatus(this.addon.status)
  }

  get unavailable (): string {
    const unavailable = this.addon.status?.unavailable

    return this.answered == null && typeof unavailable === 'string' ? unavailable : ''
  }

  get networkIdValid (): boolean {
    return tltgZerotierNetworkIdValid(this.networkId)
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

  @Watch('addon.status')
  onStatusChanged () {
    if (!this.working) {
      this.answered = null
    }
  }

  networkIdRule (value: string): boolean | string {
    return !value || tltgZerotierNetworkIdValid(value) || this.$t('app.tltg_addons.msg.zerotier_network_id_invalid').toString()
  }

  networkColor (state: TltgZerotierNetworkState): string {
    switch (state) {
      case 'ok':
        return 'success'
      case 'requesting_configuration':
        return 'info'
      case 'access_denied':
        return 'warning'
      default:
        return 'error'
    }
  }

  networkMessage (state: TltgZerotierNetworkState): string {
    switch (state) {
      case 'ok':
        return this.$t('app.tltg_addons.msg.zerotier_connected').toString()
      case 'access_denied':
        return this.$t('app.tltg_addons.msg.zerotier_needs_approval', { node: this.status?.nodeId ?? '' }).toString()
      case 'not_found':
        return this.$t('app.tltg_addons.msg.zerotier_not_found').toString()
      case 'authentication_required':
        return this.$t('app.tltg_addons.msg.zerotier_sso').toString()
      default:
        return ''
    }
  }

  isIpv4 (address: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)
  }

  async run (action: 'join' | 'leave', network: string): Promise<boolean> {
    this.working = true
    this.error = ''

    try {
      this.answered = parseTltgZerotierStatus(
        await this.request(`/addons/${encodeURIComponent(this.addon.id)}/${action}`, 'POST', undefined, { network })
      )

      return true
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)

      return false
    } finally {
      this.working = false
    }
  }

  async join () {
    if (!this.networkIdValid || this.working) {
      return
    }

    if (await this.run('join', this.networkId.trim().toLowerCase())) {
      this.networkId = ''
    }
  }

  async leave (network: TltgZerotierNetwork) {
    const confirmed = await this.$confirm(
      this.$t('app.tltg_addons.msg.zerotier_confirm_leave', { network: network.name || network.id }).toString(),
      { title: this.$t('app.tltg_addons.title.zerotier_leave').toString(), color: 'card-heading', icon: '$error' }
    )

    if (confirmed) {
      await this.run('leave', network.id)
    }
  }
}
</script>

<style lang="scss" scoped>
  .tltg-zerotier__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 28px;
    column-gap: 16px;
  }
</style>
