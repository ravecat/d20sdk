import { connect as connectToContext, WindowMessenger } from "penpal"
import type { ModuleConnectOptions, ShellMethods } from "./types"

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
