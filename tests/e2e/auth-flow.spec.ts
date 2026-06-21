import { expect, test } from "@playwright/test";

test("redirects anonymous visitors to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("logs in and reaches the wallets page", async ({ page }) => {
  await page.route(/^https?:\/\/(localhost|127\.0\.0\.1):3001\/auth\/login$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "user-1",
          email: "maria@example.com",
          name: "Maria",
          role: "MEMBER",
          defaultWalletId: null
        },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      })
    });
  });

  await page.route(/^https?:\/\/(localhost|127\.0\.0\.1):3001\/wallets$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([])
    });
  });

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("maria@example.com");
  await page.locator('input[type="password"]').fill("secret123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/wallets$/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText("Nenhuma carteira disponivel.")).toBeVisible();
});
