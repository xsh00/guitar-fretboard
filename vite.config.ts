/// <reference types="vitest" />
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

const config: UserConfig & {
  test: {
    environment: string;
    environmentOptions: {
      jsdom: {
        url: string;
      };
    };
    globals: boolean;
    setupFiles: string;
  };
} = {
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
};

export default defineConfig(config);
