import type { WindowMessenger } from "penpal"

export type WindowMessengerOptions = ConstructorParameters<typeof WindowMessenger>[0]

export type ModuleBootstrapPayload = {
  endpoint: string
  topic: string
  token: string
}

export type ShellMethods = {
  bootstrap(): ModuleBootstrapPayload
}
