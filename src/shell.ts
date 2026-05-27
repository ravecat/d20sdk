import { session } from "@rvct/phoenix"
import { atom, onMount } from "nanostores"
import { connect as connectToContext, WindowMessenger } from "penpal"
import { Socket } from "phoenix"
import type { ShellMethods, WindowMessengerOptions } from "./types"

type ShellConnectOptions = Omit<WindowMessengerOptions, "remoteWindow"> &
  Partial<Pick<WindowMessengerOptions, "remoteWindow">>

export type ShellSession<TValue = unknown> = ReturnType<typeof session<TValue>>

type ShellSessionConfig<TValue> = Omit<Parameters<typeof session<TValue>>[1], "topic">

type ReadableStore<TValue> = {
  subscribe(listener: (value: TValue) => void): () => void
}

export type ShellConnectionError = {
  kind: "bootstrap_error"
  cause: unknown
}

export type ShellConnectionState =
  | {
      readonly status: "loading"
      readonly error: null
    }
  | {
      readonly status: "standalone"
      readonly error: null
    }
  | {
      readonly status: "connected"
      readonly error: null
    }
  | {
      readonly status: "failed"
      readonly error: ShellConnectionError
    }

export type Shell<TValue = unknown> = {
  readonly connection: ReadableStore<ShellConnectionState>
  readonly session: ReadableStore<ShellSession<TValue> | null>
}

export function connect<TValue = unknown>(
  options: ShellConnectOptions = {},
  sessionConfig: ShellSessionConfig<TValue> = {},
): Shell<TValue> {
  const $connection = atom<ShellConnectionState>({
    status: "loading",
    error: null,
  })
  const $session = atom<ShellSession<TValue> | null>(null)

  let activeStores = 0
  let stopConnection = () => {}

  const startConnection = () => {
    $session.set(null)

    if (window.parent === window) {
      $connection.set({
        status: "standalone",
        error: null,
      })

      return () => {}
    }

    $connection.set({
      status: "loading",
      error: null,
    })

    let cancelled = false
    let socket: Socket | null = null
    let shellConnection: ReturnType<typeof connectToContext<ShellMethods>> | null = null

    void (async () => {
      try {
        const messengerOptions: WindowMessengerOptions = {
          ...options,
          remoteWindow: options.remoteWindow ?? window.parent,
        }

        shellConnection = connectToContext<ShellMethods>({
          messenger: new WindowMessenger(messengerOptions),
        })

        const shell = await shellConnection.promise
        const bootstrap = await shell.bootstrap()

        shellConnection.destroy()
        shellConnection = null

        if (cancelled) {
          return
        }

        socket = new Socket(bootstrap.endpoint, {
          authToken: bootstrap.token,
        })
        socket.connect()

        $session.set(
          session<TValue>(socket, {
            ...sessionConfig,
            topic: bootstrap.topic,
          }),
        )
        $connection.set({
          status: "connected",
          error: null,
        })
      } catch (cause) {
        if (cancelled) {
          return
        }

        $session.set(null)
        $connection.set({
          status: "failed",
          error: { kind: "bootstrap_error", cause },
        })
      } finally {
        shellConnection?.destroy()
        shellConnection = null
      }
    })()

    return () => {
      cancelled = true
      shellConnection?.destroy()
      socket?.disconnect()
      $session.set(null)
    }
  }

  const mountStore = () => {
    activeStores += 1

    if (activeStores === 1) {
      stopConnection = startConnection()
    }

    return () => {
      activeStores -= 1

      if (activeStores === 0) {
        stopConnection()
        stopConnection = () => {}
      }
    }
  }

  onMount($connection, mountStore)
  onMount($session, mountStore)

  return {
    connection: {
      subscribe: (listener) => $connection.subscribe(listener),
    },
    session: {
      subscribe: (listener) => $session.subscribe(listener),
    },
  }
}
