import { beforeEach, describe, expect, it, vi } from "vitest"
import { module as createModule } from "../src"

const penpal = vi.hoisted(() => {
  class MockWindowMessenger {
    readonly options: unknown

    constructor(options: unknown) {
      this.options = options
    }
  }

  return {
    connect: vi.fn(),
    WindowMessenger: vi.fn(MockWindowMessenger),
  }
})

vi.mock("penpal", () => penpal)

describe("module adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should expose bootstrap through the Penpal connection", () => {
    const connection = {
      promise: Promise.resolve({}),
      destroy: vi.fn(),
    }
    const remoteWindow = {} as Window
    const bootstrap = {
      endpoint: "wss://shell.example.com/module",
      topic: "session:abc123",
      token: "signed-token",
    }
    penpal.connect.mockReturnValue(connection)

    const result = createModule({
      remoteWindow,
      allowedOrigins: ["https://module.example.com"],
      bootstrap,
    })

    expect(result).toBe(connection)
    expect(penpal.WindowMessenger).toHaveBeenCalledWith({
      remoteWindow,
      allowedOrigins: ["https://module.example.com"],
    })

    const options = penpal.connect.mock.calls[0]?.[0]

    expect(options.messenger).toBeInstanceOf(penpal.WindowMessenger)
    expect(options.methods?.bootstrap()).toBe(bootstrap)
  })
})
