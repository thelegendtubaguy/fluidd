<template>
  <v-sheet
    outlined
    rounded
    class="px-3 py-2"
  >
    <div class="tltg-tailscale__row">
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
      <div class="tltg-tailscale__row">
        <span class="secondary--text">{{ $t('app.tltg_addons.label.tailscale') }}</span>
        <span :class="`${stateColor}--text`">{{ $t(`app.tltg_addons.tailscale_state.${status.state}`) }}</span>
      </div>

      <template v-if="status.state === 'running'">
        <div
          v-if="status.tailnet"
          class="tltg-tailscale__row"
        >
          <span class="secondary--text">{{ $t('app.tltg_addons.label.tailnet') }}</span>
          <span class="text-break text-right">{{ status.tailnet }}</span>
        </div>

        <div
          v-if="status.name"
          class="tltg-tailscale__row"
        >
          <span class="secondary--text">{{ $t('app.tltg_addons.label.tailscale_name') }}</span>
          <a
            :href="`http://${status.name}/`"
            target="_blank"
            rel="noopener noreferrer"
            class="text-break text-right"
          >{{ status.name }}</a>
        </div>

        <div
          v-if="status.addresses.length > 0"
          class="tltg-tailscale__row"
        >
          <span class="secondary--text">{{ $t('app.tltg_addons.label.tailscale_address') }}</span>
          <span class="text-break text-right">
            <template v-for="(address, index) in status.addresses">
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
          v-if="status.keyExpiry"
          class="tltg-tailscale__row"
        >
          <span class="secondary--text">{{ $t('app.tltg_addons.label.tailscale_key_expiry') }}</span>
          <span class="text-right">{{ $filters.formatDateTime(status.keyExpiry) }}</span>
        </div>

        <div class="text-body-2 secondary--text mt-1">
          {{ $t('app.tltg_addons.msg.tailscale_running') }}
        </div>

        <v-alert
          v-for="problem in status.problems"
          :key="problem"
          dense
          text
          type="warning"
          class="mt-2 mb-0"
        >
          {{ problem }}
        </v-alert>
      </template>

      <div
        v-else-if="status.state === 'needs_approval'"
        class="text-body-2 mt-1"
      >
        {{ $t('app.tltg_addons.msg.tailscale_needs_approval') }}
      </div>

      <template v-else-if="status.state === 'needs_login'">
        <div class="text-body-2 mt-1">
          {{ $t(status.loginUrl ? 'app.tltg_addons.msg.tailscale_sign_in' : 'app.tltg_addons.msg.tailscale_needs_login') }}
        </div>

        <div
          v-if="status.loginUrl"
          class="text-center my-2"
        >
          <a
            :href="status.loginUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-break"
          >{{ status.loginUrl }}</a>
        </div>
      </template>

      <v-alert
        v-if="error"
        dense
        text
        type="error"
        class="mt-2 mb-0"
      >
        {{ error }}
      </v-alert>

      <div class="d-flex flex-wrap justify-end mt-1">
        <template v-if="status.state === 'needs_login'">
          <app-btn
            v-if="status.loginUrl"
            small
            color="primary"
            class="ml-2 my-1"
            :href="status.loginUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ $t('app.tltg_addons.btn.tailscale_sign_in') }}
            <v-icon
              small
              right
            >
              $openInNew
            </v-icon>
          </app-btn>
          <app-btn
            small
            :outlined="!!status.loginUrl"
            color="primary"
            class="ml-2 my-1"
            :loading="working"
            @click="run('login')"
          >
            {{ $t(status.loginUrl ? 'app.tltg_addons.btn.tailscale_new_link' : 'app.tltg_addons.btn.tailscale_log_in') }}
          </app-btn>
        </template>

        <app-btn
          v-else-if="status.state === 'stopped'"
          small
          color="primary"
          class="ml-2 my-1"
          :loading="working"
          @click="run('login')"
        >
          {{ $t('app.tltg_addons.btn.tailscale_connect') }}
        </app-btn>

        <app-btn
          v-if="status.state === 'running' || status.state === 'stopped' || status.state === 'needs_approval'"
          small
          outlined
          color="error"
          class="ml-2 my-1"
          :disabled="working"
          @click="logOut"
        >
          {{ $t('app.tltg_addons.btn.tailscale_log_out') }}
        </app-btn>
      </div>
    </template>
  </v-sheet>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import { parseTltgTailscaleStatus, type TltgAddon, type TltgTailscaleStatus as TailscaleStatus } from '@/util/tltg-addons'

@Component({})
export default class TltgTailscaleStatus extends Vue {
  @Prop({ type: Object, required: true })
  readonly addon!: TltgAddon

  @Prop({ type: Function, required: true })
  readonly request!: (path: string, method?: 'GET' | 'POST') => Promise<unknown>

  // What the last log in or log out answered, shown until the add-ons list is read again.
  answered: TailscaleStatus | null = null
  working = false
  error = ''

  get status (): TailscaleStatus | null {
    return this.answered ?? parseTltgTailscaleStatus(this.addon.status)
  }

  get unavailable (): string {
    const unavailable = this.addon.status?.unavailable

    return this.answered == null && typeof unavailable === 'string' ? unavailable : ''
  }

  get stateColor (): string {
    switch (this.status?.state) {
      case 'running':
        return 'success'
      case 'starting':
        return 'info'
      default:
        return 'warning'
    }
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

  isIpv4 (address: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)
  }

  async run (action: 'login' | 'logout') {
    this.working = true
    this.error = ''

    try {
      this.answered = parseTltgTailscaleStatus(await this.request(`/addons/${encodeURIComponent(this.addon.id)}/${action}`, 'POST'))
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    } finally {
      this.working = false
    }
  }

  async logOut () {
    const confirmed = await this.$confirm(
      this.$t('app.tltg_addons.msg.tailscale_confirm_log_out').toString(),
      { title: this.$t('app.tltg_addons.title.tailscale_log_out').toString(), color: 'card-heading', icon: '$error' }
    )

    if (confirmed) {
      await this.run('logout')
    }
  }
}
</script>

<style lang="scss" scoped>
  .tltg-tailscale__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 28px;
    column-gap: 16px;
  }
</style>
