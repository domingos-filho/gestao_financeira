import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "fadomingosf@gmail.com";
const loginPassword = process.env.E2E_LOGIN_PASSWORD ?? "secret123";
const walletName = process.env.E2E_WALLET_NAME ?? "Familia Domingos";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(loginPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("redirects anonymous visitors to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("logs in against the real API and opens the seeded wallet", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page).toHaveURL(/\/wallets$/);
  await expect(page.getByText(walletName, { exact: true })).toBeVisible();

  await page.getByText(walletName, { exact: true }).click();
  await expect(page).toHaveURL(/\/wallets\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(`Carteira: ${walletName}`)).toBeVisible();
});
