import { connect, WindowMessenger } from "penpal"
import type { ModuleBootstrapPayload, ShellMethods, WindowMessengerOptions } from "./types"

type ModuleConnectOptions = WindowMessengerOptions & {
  bootstrap: ModuleBootstrapPayload
}

export function module(options: ModuleConnectOptions) {
  const { bootstrap, ...messengerOptions } = options
  const methods: ShellMethods = {
    bootstrap() {
      return bootstrap
    },
  }

  return connect({
    messenger: new WindowMessenger(messengerOptions),
    methods,
  })
}
