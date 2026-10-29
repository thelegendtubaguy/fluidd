<template>
  <div
    class="qidi-screen-view"
    :class="{ 'qidi-screen-view--fullscreen': fullscreen }"
  >
    <canvas
      ref="canvas"
      :width="width"
      :height="height"
      class="qidi-screen-view__canvas"
      :class="{
        'qidi-screen-view__canvas--control': canControl,
        'qidi-screen-view__canvas--dim': !hasFrame || state !== 'live'
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @lostpointercapture="onPointerCancel"
      @contextmenu="event => canControl && event.preventDefault()"
    />
    <div
      v-if="status"
      class="qidi-screen-view__status"
    >
      {{ status }}
    </div>
    <div
      v-else-if="state === 'live' && message"
      class="qidi-screen-view__notice"
    >
      {{ $t('app.qidi_screen.msg.view_only', { reason: message }) }}
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import { SocketActions } from '@/api/socketActions'

const RETRY_DELAYS = [1000, 2000, 5000, 10000]
const MOVE_INTERVAL = 30

interface Point {
  x: number;
  y: number;
}

// Live view of the printer's touchscreen from Qidi-Max-4-Optimized's tltg-remote-screen service, reached through
// the nginx serving Fluidd at /tltg-screen/ws. It connects only while shown in a visible tab.
@Component({})
export default class QidiScreenView extends Vue {
  @Prop({ type: Boolean })
  readonly control!: boolean

  state: 'connecting' | 'live' | 'error' | 'disconnected' | 'paused' = 'connecting'
  message = ''
  width = 800
  height = 480
  touch = false
  hasFrame = false
  fullscreen = false

  socket: WebSocket | null = null
  connecting = false
  retry = 0
  timer: ReturnType<typeof setTimeout> | undefined = undefined
  closed = false
  pointer: number | null = null
  lastMove = 0
  decoding = false
  nextFrame: Blob | null = null

  get canControl (): boolean {
    return this.control && this.touch && this.state === 'live'
  }

  get status (): string {
    if (this.state === 'error') return this.$t('app.qidi_screen.msg.unavailable', { reason: this.message }).toString()
    if (this.state === 'disconnected') return this.$t('app.qidi_screen.msg.reconnecting').toString()
    if (this.state === 'paused') return this.$t('app.qidi_screen.msg.paused').toString()
    if (!this.hasFrame) return this.$t('app.qidi_screen.msg.connecting').toString()

    return ''
  }

  @Watch('control')
  onControlChanged (value: boolean) {
    if (!value) this.release()
  }

  @Watch('touch')
  onTouchChanged (value: boolean) {
    this.$emit('touch', value)
  }

  mounted () {
    document.addEventListener('visibilitychange', this.onVisibility)
    document.addEventListener('fullscreenchange', this.onFullscreen)
    // Cards can render expanded briefly before the saved layout collapses them; a collapsed card never connects.
    this.timer = setTimeout(() => this.connect(), 250)
  }

  beforeDestroy () {
    this.closed = true
    document.removeEventListener('visibilitychange', this.onVisibility)
    document.removeEventListener('fullscreenchange', this.onFullscreen)
    this.disconnect()
  }

  // The service accepts only same-origin connections, so connect through the nginx serving this page.
  socketUrl (token: string): string {
    const url = new URL('/tltg-screen/ws', window.location.origin)

    url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    if (token) url.search = `?token=${encodeURIComponent(token)}`

    return url.toString()
  }

  async connect () {
    if (this.closed || document.hidden || this.socket || this.connecting) return

    clearTimeout(this.timer)
    this.connecting = true

    let token = ''

    try {
      // A one-shot token proves this Fluidd session when Moonraker requires logins.
      token = await SocketActions.accessOneshotToken({ suppressError: true })
    } catch {
      token = ''
    }

    this.connecting = false

    if (this.closed || document.hidden || this.socket) return

    const socket = new WebSocket(this.socketUrl(token))

    socket.binaryType = 'blob'
    socket.onmessage = event => this.onMessage(socket, event)
    socket.onclose = () => this.onClose(socket)
    this.socket = socket
  }

  disconnect () {
    clearTimeout(this.timer)
    this.timer = undefined

    const socket = this.socket

    this.socket = null
    this.pointer = null

    if (socket) {
      socket.onmessage = null
      socket.onclose = null
      socket.close()
    }
  }

  onVisibility () {
    if (document.hidden) {
      this.disconnect()
      this.state = 'paused'
    } else {
      this.connect()
    }
  }

  onFullscreen () {
    this.fullscreen = document.fullscreenElement === this.$el
  }

  onMessage (socket: WebSocket, event: MessageEvent) {
    if (socket !== this.socket) return

    if (typeof event.data !== 'string') {
      this.draw(event.data)
      return
    }

    let message: Record<string, any>

    try {
      message = JSON.parse(event.data) as Record<string, any>
    } catch {
      return
    }

    if (message.type === 'hello') {
      this.state = 'live'
      this.message = message.touch ? '' : message.touch_error || this.$t('app.qidi_screen.msg.no_touch').toString()
      this.width = message.width
      this.height = message.height
      this.touch = !!message.touch
      this.retry = 0
    } else if (message.type === 'error') {
      this.state = 'error'
      this.message = message.message
    }
  }

  onClose (socket: WebSocket) {
    if (socket !== this.socket) return

    this.socket = null
    this.pointer = null

    if (this.closed) return

    if (this.state !== 'error') {
      this.state = 'disconnected'
      this.message = ''
    }

    const delay = RETRY_DELAYS[Math.min(this.retry, RETRY_DELAYS.length - 1)]

    this.retry++
    this.timer = setTimeout(() => this.connect(), delay)
  }

  // Frames that arrive while one is decoding are skipped in favor of the newest.
  async draw (blob: Blob) {
    if (this.decoding) {
      this.nextFrame = blob
      return
    }

    this.decoding = true

    try {
      const bitmap = await createImageBitmap(blob)
      const canvas = this.$refs.canvas as HTMLCanvasElement | undefined

      if (canvas) {
        if (canvas.width !== bitmap.width) canvas.width = bitmap.width
        if (canvas.height !== bitmap.height) canvas.height = bitmap.height
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
        this.hasFrame = true
      }

      bitmap.close()
    } catch {
      // A frame that fails to decode is dropped.
    }

    this.decoding = false

    const next = this.nextFrame

    this.nextFrame = null

    if (next && !this.closed) this.draw(next)
  }

  // The canvas letterboxes the screen in full screen, so map through the fitted image.
  position (event: PointerEvent): Point {
    const rect = (this.$refs.canvas as HTMLCanvasElement).getBoundingClientRect()
    const scale = Math.min(rect.width / this.width, rect.height / this.height)
    const left = rect.left + (rect.width - this.width * scale) / 2
    const top = rect.top + (rect.height - this.height * scale) / 2
    const clamp = (value: number, size: number) => Math.max(0, Math.min(size - 1, Math.round(value)))

    return {
      x: clamp((event.clientX - left) / scale, this.width),
      y: clamp((event.clientY - top) / scale, this.height)
    }
  }

  send (action: 'down' | 'move' | 'up', point: Point) {
    const socket = this.socket

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'touch', action, x: point.x, y: point.y }))
    }
  }

  release () {
    if (this.pointer == null) return

    this.pointer = null
    this.send('up', { x: 0, y: 0 })
  }

  onPointerDown (event: PointerEvent) {
    if (!this.canControl || this.pointer != null || event.button !== 0) return

    event.preventDefault()
    this.pointer = event.pointerId;
    (this.$refs.canvas as HTMLCanvasElement).setPointerCapture?.(event.pointerId)
    this.lastMove = performance.now()
    this.send('down', this.position(event))
  }

  onPointerMove (event: PointerEvent) {
    if (event.pointerId !== this.pointer) return

    event.preventDefault()

    const now = performance.now()

    if (now - this.lastMove >= MOVE_INTERVAL) {
      this.lastMove = now
      this.send('move', this.position(event))
    }
  }

  onPointerUp (event: PointerEvent) {
    if (event.pointerId !== this.pointer) return

    event.preventDefault()
    this.send('move', this.position(event))
    this.release()
  }

  onPointerCancel (event: PointerEvent) {
    if (event.pointerId === this.pointer) this.release()
  }
}
</script>

<style scoped>
.qidi-screen-view {
  position: relative;
  background: #000;
  line-height: 0;
}

.qidi-screen-view--fullscreen {
  display: flex;
  align-items: center;
  justify-content: center;
}

.qidi-screen-view__canvas {
  display: block;
  width: 100%;
  height: auto;
  touch-action: auto;
  cursor: default;
}

.qidi-screen-view--fullscreen .qidi-screen-view__canvas {
  height: 100%;
  object-fit: contain;
}

.qidi-screen-view__canvas--control {
  touch-action: none;
  cursor: pointer;
}

.qidi-screen-view__canvas--dim {
  opacity: 0.4;
}

.qidi-screen-view__status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: #fff;
  text-align: center;
  line-height: 1.4;
  pointer-events: none;
}

.qidi-screen-view__notice {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  line-height: 1.4;
  font-size: 12px;
  pointer-events: none;
}
</style>
