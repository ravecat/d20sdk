import { session } from "@rvct/phoenix"
import { atom, onMount } from "nanostores"
import { connect as connectToContext, WindowMessenger } from "penpal"
import { Socket } from "phoenix"
import type { ShellMethods, WindowMessengerOptions } from "./types"

type NoActions = Record<never, never>
type RuntimeActions = Record<string, unknown>

type ShellConnectOptions = Omit<WindowMessengerOptions, "remoteWindow"> &
  Partial<Pick<WindowMessengerOptions, "remoteWindow">>

type InnerSession<TValue> = ReturnType<typeof session<TValue>>

type InnerSessionConfig<TValue> = Parameters<typeof session<TValue>>[1]

type ShellSessionConfig<TValue> = Omit<InnerSessionConfig<TValue>, "topic">

type InnerSessionState<TValue> = Parameters<Parameters<InnerSession<TValue>["subscribe"]>[0]>[0]

type InnerSessionExtensionFactory<TValue> = Parameters<InnerSession<TValue>["extend"]>[0]

type InnerSessionActionContext<TValue> = Parameters<InnerSessionExtensionFactory<TValue>>[0]

type ActionNameOf<TExtension extends object> = {
  [K in keyof TExtension]: TExtension[K] extends (...args: never[]) => unknown ? K : never
}[keyof TExtension]

type ActionErrorOf<TAction> = TAction extends (...args: never[]) => {
  receive(status: "error", callback: (response: infer TError) => unknown): unknown
}
  ? TError
  : unknown

type SessionActionsOf<TExtension extends object> = {
  readonly [K in Extract<ActionNameOf<TExtension>, string>]: ActionErrorOf<TExtension[K]>
}

type ShellSessionState<TValue, TActions extends Record<string, unknown> = NoActions> = Omit<
  InnerSessionState<TValue>,
  "processing" | "errors" | "timeouts"
> & {
  readonly processing: { readonly [K in keyof TActions]: boolean }
  readonly errors: { readonly [K in keyof TActions]: TActions[K] | null }
  readonly timeouts: { readonly [K in keyof TActions]: boolean }
}

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

export type ShellSession<
  TValue = unknown,
  TActions extends Record<string, unknown> = NoActions,
> = ReadableStore<ShellSessionState<TValue, TActions>> & {
  extend<TExtension extends object>(
    defineExtension: (session: InnerSessionActionContext<TValue>) => TExtension,
  ): ShellSession<TValue, SessionActionsOf<TExtension>> & TExtension
}

export type Shell<TValue = unknown> = {
  readonly connection: ReadableStore<ShellConnectionState>
  readonly session: ShellSession<TValue>
}

type ShellSessionExtension<TValue> = {
  defineExtension: InnerSessionExtensionFactory<TValue>
  extension: object
  session: Record<string, unknown> | null
}

export function connect<TValue = unknown>(
  options: ShellConnectOptions = {},
  sessionConfig: ShellSessionConfig<TValue> = {},
): Shell<TValue> {
  const $connection = atom<ShellConnectionState>({
    status: "loading",
    error: null,
  })

  const createInitialSessionState = (): ShellSessionState<TValue, RuntimeActions> => ({
    value: sessionConfig.value ?? null,
    status: "loading",
    error: null,
    processing: {},
    errors: {},
    timeouts: {},
  })

  let currentSessionState = createInitialSessionState()
  const $session = atom<ShellSessionState<TValue, RuntimeActions>>(currentSessionState)
  const setSessionState = (state: ShellSessionState<TValue, RuntimeActions>) => {
    currentSessionState = state
    $session.set(state)
  }
  const subscribeSession = <TActions extends Record<string, unknown>>(
    listener: (value: ShellSessionState<TValue, TActions>) => void,
  ) => $session.subscribe(listener as (value: ShellSessionState<TValue, RuntimeActions>) => void)

  let innerSession: InnerSession<TValue> | null = null
  const sessionExtensions: Array<ShellSessionExtension<TValue>> = []

  const registerSessionActions = (extension: object) => {
    let processing = currentSessionState.processing
    let errors = currentSessionState.errors
    let timeouts = currentSessionState.timeouts
    let changed = false

    for (const [action, value] of Object.entries(extension)) {
      if (typeof value !== "function") {
        continue
      }

      if (!(action in processing)) {
        processing = { ...processing, [action]: false }
        changed = true
      }

      if (!(action in errors)) {
        errors = { ...errors, [action]: null }
        changed = true
      }

      if (!(action in timeouts)) {
        timeouts = { ...timeouts, [action]: false }
        changed = true
      }
    }

    if (changed) {
      setSessionState({
        ...currentSessionState,
        processing,
        errors,
        timeouts,
      })
    }
  }

  const resetSessionState = () => {
    setSessionState(createInitialSessionState())

    for (const sessionExtension of sessionExtensions) {
      registerSessionActions(sessionExtension.extension)
    }
  }

  let activeStores = 0
  let stopConnection = () => {}

  const startConnection = () => {
    if (window.parent === window) {
      $connection.set({
        status: "standalone",
        error: null,
      })
      resetSessionState()
      return () => {}
    }

    $connection.set({
      status: "loading",
      error: null,
    })
    resetSessionState()

    let cancelled = false
    let unsubscribeInnerSession = () => {}
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

        innerSession = session<TValue>(socket, {
          ...sessionConfig,
          topic: bootstrap.topic,
        })

        for (const sessionExtension of sessionExtensions) {
          sessionExtension.session = innerSession.extend(sessionExtension.defineExtension)
        }

        unsubscribeInnerSession = innerSession.subscribe((nextState) => {
          setSessionState(nextState as ShellSessionState<TValue, RuntimeActions>)
        })

        $connection.set({
          status: "connected",
          error: null,
        })
      } catch (cause) {
        if (cancelled) {
          return
        }

        resetSessionState()
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
      unsubscribeInnerSession()
      shellConnection?.destroy()
      socket?.disconnect()
      innerSession = null
      for (const sessionExtension of sessionExtensions) {
        sessionExtension.session = null
      }
      resetSessionState()
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

  const extendSession = <TExtension extends object>(
    defineExtension: (session: InnerSessionActionContext<TValue>) => TExtension,
  ) => {
    const extension = defineExtension({
      call: ((event: string) => {
        throw new Error(`Cannot call "${event}" before inner session is ready`)
      }) as InnerSessionActionContext<TValue>["call"],
      cast: ((event: string) => {
        throw new Error(`Cannot cast "${event}" before inner session is ready`)
      }) as InnerSessionActionContext<TValue>["cast"],
    })

    const sessionExtension: ShellSessionExtension<TValue> = {
      defineExtension: defineExtension as InnerSessionExtensionFactory<TValue>,
      extension,
      session:
        innerSession?.extend(defineExtension as InnerSessionExtensionFactory<TValue>) ?? null,
    }
    sessionExtensions.push(sessionExtension)
    registerSessionActions(extension)

    const wrappedExtension = { ...extension } as Record<string, unknown>

    for (const [action, value] of Object.entries(extension)) {
      if (typeof value !== "function") {
        continue
      }

      wrappedExtension[action] = function (this: unknown, ...args: unknown[]) {
        const method = sessionExtension.session?.[action]

        if (typeof method !== "function") {
          throw new Error(`Cannot run "${action}" before inner session is ready`)
        }

        return method.apply(this, args)
      }
    }

    return {
      ...(wrappedExtension as TExtension),
      subscribe: (listener) => subscribeSession(listener),
      extend: extendSession,
    } as ShellSession<TValue, SessionActionsOf<TExtension>> & TExtension
  }

  const shellSession: ShellSession<TValue> = {
    subscribe: (listener) => subscribeSession(listener),
    extend: extendSession,
  }

  return {
    connection: {
      subscribe: (listener) => $connection.subscribe(listener),
    },
    session: shellSession,
  }
}
