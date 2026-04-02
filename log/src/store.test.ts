import { Provider } from "@algorandfoundation/wallet-provider";
import { Store } from "@tanstack/store";
import { describe, expect, it } from "vitest";
import { WithLogStore } from "./extension.ts";
import { addLog, clearLogs, getLog, removeLog } from "./store.ts";
import type { LogMessage, LogStoreState } from "./types.ts";

describe("Log Store Extension", () => {
  it("should align with README usage", async () => {
    const MyProvider = Provider.withExtensions([WithLogStore]);
    const provider = new MyProvider({ id: "test", name: "Test" }) as any;

    // Access log store methods
    await provider.log.info("Hello");
    expect(provider.logs).toHaveLength(1);
    expect(provider.logs[0].message).toEqual("Hello");

    await provider.log.clear();
    expect(provider.logs).toHaveLength(0);
  });

  describe("store functions", () => {
    it("should add a log", () => {
      const store = new Store<LogStoreState>({
        logs: [],
      });
      const log: LogMessage = {
        id: "1",
        timestamp: new Date(),
        level: "info",
        message: "test",
      };
      addLog({ store, log });
      expect(store.state.logs).toContain(log);
    });

    it("should remove a log", () => {
      const log: LogMessage = {
        id: "1",
        timestamp: new Date(),
        level: "info",
        message: "test",
      };
      const store = new Store<LogStoreState>({
        logs: [log],
      });
      removeLog({ store, logId: "1" });
      expect(store.state.logs).not.toContain(log);
    });

    it("should get a log", () => {
      const log: LogMessage = {
        id: "1",
        timestamp: new Date(),
        level: "info",
        message: "test",
      };
      const store = new Store<LogStoreState>({
        logs: [log],
      });
      const found = getLog({ store, logId: "1" });
      expect(found).toEqual(log);
    });

    it("should return undefined for non-existent log", () => {
      const store = new Store<LogStoreState>({
        logs: [],
      });
      const found = getLog({ store, logId: "non-existent" });
      expect(found).toBeUndefined();
    });
    it("should clear logs", () => {
      const log: LogMessage = {
        id: "1",
        timestamp: new Date(),
        level: "info",
        message: "test",
      };
      const store = new Store<LogStoreState>({
        logs: [log],
      });
      clearLogs({ store });
      expect(store.state.logs).toHaveLength(0);
    });
  });
});
