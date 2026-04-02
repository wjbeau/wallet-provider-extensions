import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./__mocks__/react-native-setup.ts"],
    environment: "node",
    globals: true,
  },
});
