import type { session } from "@rvct/phoenix"
import type { WindowMessenger } from "penpal"

export type WindowMessengerOptions = ConstructorParameters<typeof WindowMessenger>[0]

type InnerSession<TSessionSpec> = ReturnType<typeof session<TSessionSpec>>

export type InnerSessionState<TSessionSpec> = Parameters<
  Parameters<InnerSession<TSessionSpec>["subscribe"]>[0]
>[0]

type InnerSessionExtensionFactory<TSessionSpec> = Parameters<
  InnerSession<TSessionSpec>["extend"]
>[0]

export type ShellRuntimeActionContext<TSessionSpec> = Parameters<
  InnerSessionExtensionFactory<TSessionSpec>
>[0]

export type ShellBootstrapError = {
  kind: "bootstrap_error"
  cause: unknown
}

export type ShellStandaloneState<TSessionSpec> = Omit<
  InnerSessionState<TSessionSpec>,
  "status" | "error"
> & {
  readonly status: "standalone"
  readonly error: null
}

export type ShellBootstrapFailedState<TSessionSpec> = Omit<
  InnerSessionState<TSessionSpec>,
  "status" | "error"
> & {
  readonly status: "failed"
  readonly error: ShellBootstrapError
}

export type ShellRuntimeState<TSessionSpec> =
  | InnerSessionState<TSessionSpec>
  | ShellStandaloneState<TSessionSpec>
  | ShellBootstrapFailedState<TSessionSpec>

export type ShellRuntimeReadable<TSessionSpec> = {
  subscribe(listener: (value: ShellRuntimeState<TSessionSpec>) => void): () => void
}

export type ShellRuntime<TSessionSpec> = ShellRuntimeReadable<TSessionSpec> & {
  extend<TExtension extends object>(
    defineExtension: (session: ShellRuntimeActionContext<TSessionSpec>) => TExtension,
  ): ShellRuntimeReadable<TSessionSpec> & TExtension
}

export type ModuleBootstrapPayload = {
  endpoint: string
  topic: string
  token: string
}

export type ModuleConnectOptions = WindowMessengerOptions & {
  bootstrap: ModuleBootstrapPayload
}

export type ShellConnectOptions = Omit<WindowMessengerOptions, "remoteWindow"> &
  Partial<Pick<WindowMessengerOptions, "remoteWindow">>

export type ShellMethods = {
  bootstrap(): ModuleBootstrapPayload
}
