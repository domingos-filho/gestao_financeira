import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "../src/components/brand-logo";

describe("BrandMark", () => {
  it("renders the logo image", () => {
    render(<BrandMark />);

    const image = screen.getByRole("img", { name: /uniconta/i });
    expect(image).toHaveAttribute("src", "/icons/logo%20principal.png");
  });
});
