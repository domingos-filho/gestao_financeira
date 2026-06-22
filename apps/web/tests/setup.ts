import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, unoptimized, priority, ...rest } = props;
    const imageSrc = typeof src === "string" ? src : (src as { src?: string } | undefined)?.src ?? "";
    return createElement("img", { src: imageSrc, alt, ...rest });
  }
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
