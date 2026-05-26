import { session } from "@rvct/phoenix"
import { atom, onMount } from "nanostores"
import { connect as connectToContext, WindowMessenger } from "penpal"
import { Socket } from "phoenix"
import type {
  InnerSessionState,
  ShellConnectOptions,
  ShellMethods,
  ShellRuntime,
  ShellRuntimeActionContext,
  ShellRuntimeReadable,
  ShellRuntimeState,
  WindowMessengerOptions,
} from "./types"

type RuntimeSession<TSessionSpec> = ReturnType<typeof session<TSessionSpec & object>>
type RuntimeExtensionFactory<TSessionSpec> = Parameters<RuntimeSession<TSessionSpec>["extend"]>[0]
type RuntimeExtension<TSessionSpec> = {
  defineExtension: RuntimeExtensionFactory<TSessionSpec>
  runtime: (ShellRuntimeReadable<TSessionSpec> & Record<string, unknown>) | null
}

export function connect<TSessionSpec = object>(
  options: ShellConnectOptions = {},
): ShellRuntime<TSessionSpec> {
  const initialState = {
    value: null,
    status: "loading",
    error: null,
    processing: {},
    errors: {},
    timeouts: {},
  } as InnerSessionState<TSessionSpec>

  const $state = atom<ShellRuntimeState<TSessionSpec>>(initialState)
  let hasStarted = false
  let innerSession: RuntimeSession<TSessionSpec> | null = null
  const runtimeExtensions: Array<RuntimeExtension<TSessionSpec>> = []

  onMount($state, () => {
    hasStarted = true

    if (window.parent === window) {
      $state.set({
        ...initialState,
        status: "standalone",
        error: null,
      } as ShellRuntimeState<TSessionSpec>)
      return
    }

    $state.set(initialState)

    let cancelled = false
    let unsubscribeInnerRuntime = () => {}
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

        innerSession = session<TSessionSpec & object>(socket, {
          topic: bootstrap.topic,
        })

        for (const runtimeExtension of runtimeExtensions) {
          runtimeExtension.runtime = innerSession.extend(
            runtimeExtension.defineExtension,
          ) as ShellRuntimeReadable<TSessionSpec> & Record<string, unknown>
        }

        unsubscribeInnerRuntime = innerSession.subscribe((nextState) => {
          $state.set(nextState)
        })
      } catch (cause) {
        if (cancelled) {
          return
        }

        $state.set({
          ...initialState,
          status: "failed",
          error: { kind: "bootstrap_error", cause },
        } as ShellRuntimeState<TSessionSpec>)
      } finally {
        shellConnection?.destroy()
        shellConnection = null
      }
    })()

    return () => {
      cancelled = true
      unsubscribeInnerRuntime()
      shellConnection?.destroy()
      socket?.disconnect()
      innerSession = null
      for (const runtimeExtension of runtimeExtensions) {
        runtimeExtension.runtime = null
      }
    }
  })

  return {
    subscribe: (listener) => $state.subscribe(listener),
    extend<TExtension extends object>(
      defineExtension: (session: ShellRuntimeActionContext<TSessionSpec>) => TExtension,
    ) {
      if (hasStarted) {
        throw new Error("Cannot extend shell runtime after it has started")
      }

      const runtimeExtension: RuntimeExtension<TSessionSpec> = {
        defineExtension: defineExtension as RuntimeExtensionFactory<TSessionSpec>,
        runtime: null,
      }
      runtimeExtensions.push(runtimeExtension)

      const extension = defineExtension({
        subscribe: ((listener: (value: InnerSessionState<TSessionSpec>) => void) =>
          $state.subscribe(
            listener as (value: ShellRuntimeState<TSessionSpec>) => void,
          )) as ShellRuntimeActionContext<TSessionSpec>["subscribe"],
        push: ((event: string) => {
          throw new Error(`Cannot push "${event}" before shell runtime is ready`)
        }) as ShellRuntimeActionContext<TSessionSpec>["push"],
      })

      const wrappedExtension = { ...extension } as Record<string, unknown>

      for (const [action, value] of Object.entries(extension)) {
        if (typeof value !== "function") {
          continue
        }

        wrappedExtension[action] = function (this: unknown, ...args: unknown[]) {
          const method = runtimeExtension.runtime?.[action]

          if (typeof method !== "function") {
            throw new Error(`Cannot run "${action}" before shell runtime is ready`)
          }

          return method.apply(this, args)
        }
      }

      return {
        ...(wrappedExtension as TExtension),
        subscribe: (listener) => $state.subscribe(listener),
      }
    },
  }
}
