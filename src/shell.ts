import { session as createSession } from "@rvct/phoenix"
import { atom } from "nanostores"
import { connect, WindowMessenger } from "penpal"
import { Socket } from "phoenix"
import type { ShellMethods, WindowMessengerOptions } from "./types"

type ShellConnectOptions = Omit<WindowMessengerOptions, "remoteWindow"> &
  Partial<Pick<WindowMessengerOptions, "remoteWindow">>

type OneArgOverloadFirstParameter<TFunction> = TFunction extends {
  (...args: infer TFirst): unknown
  (...args: infer TSecond): unknown
}
  ? Extract<TFirst | TSecond, [] | [unknown?]>[0]
  : never

type ReadableStore<TValue> = {
  subscribe(listener: (value: TValue) => void): () => void
}

type ShellConnectionState =
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
      readonly error: {
        kind: "bootstrap_error"
        cause: unknown
      }
    }

type Shell<TValue = unknown> = {
  readonly connection: ReadableStore<ShellConnectionState>
  readonly session: ReturnType<typeof createSession<TValue>>
}

export function shell<TValue = unknown>(
  options: ShellConnectOptions = {},
  sessionConfig: OneArgOverloadFirstParameter<typeof createSession<TValue>> = {},
): Shell<TValue> {
  const $connection = atom<ShellConnectionState>({
    status: "loading",
    error: null,
  })
  const session = createSession<TValue>(sessionConfig)

  let started = false
  let socket: Socket | null = null

  const start = () => {
    if (started) {
      return
    }

    started = true
    session.detach()

    const currentWindow = typeof window === "undefined" ? null : window

    if (!currentWindow || currentWindow.parent === currentWindow) {
      $connection.set({
        status: "standalone",
        error: null,
      })

      return
    }

    $connection.set({
      status: "loading",
      error: null,
    })

    void (async () => {
      try {
        const messengerOptions: WindowMessengerOptions = {
          ...options,
          remoteWindow: options.remoteWindow ?? currentWindow.parent,
        }

        const connection = connect<ShellMethods>({
          messenger: new WindowMessenger(messengerOptions),
        })

        try {
          const shell = await connection.promise
          const bootstrap = await shell.bootstrap()

          socket = new Socket(bootstrap.endpoint, {
            authToken: bootstrap.token,
          })
          socket.connect()

          session.attach(socket, {
            topic: bootstrap.topic,
          })
          $connection.set({
            status: "connected",
            error: null,
          })
        } finally {
          connection.destroy()
        }
      } catch (cause) {
        session.detach()
        $connection.set({
          status: "failed",
          error: { kind: "bootstrap_error", cause },
        })
      }
    })()
  }

  return {
    connection: {
      subscribe(listener) {
        start()
        return $connection.subscribe(listener)
      },
    },
    session: {
      ...session,
      subscribe(listener) {
        start()
        return session.subscribe(listener)
      },
      extend(extension) {
        const extendedSession = session.extend(extension)

        return {
          ...extendedSession,
          subscribe(listener) {
            start()
            return extendedSession.subscribe(listener)
          },
        }
      },
    },
  }
}
