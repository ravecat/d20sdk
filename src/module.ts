import { connect as connectToContext, WindowMessenger } from "penpal"
import type { ModuleBootstrapPayload, ShellMethods, WindowMessengerOptions } from "./types"

type ModuleConnectOptions = WindowMessengerOptions & {
  bootstrap: ModuleBootstrapPayload
}

export function connect(options: ModuleConnectOptions) {
  const { bootstrap, ...messengerOptions } = options
  const methods: ShellMethods = {
    bootstrap() {
      return bootstrap
    },
  }

  return connectToContext({
    messenger: new WindowMessenger(messengerOptions),
    methods,
  })
}
