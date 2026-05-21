import type { WindowMessenger } from "penpal"

export type WindowMessengerOptions = ConstructorParameters<typeof WindowMessenger>[0]

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
