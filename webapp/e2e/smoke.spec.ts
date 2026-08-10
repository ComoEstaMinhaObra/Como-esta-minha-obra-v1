import { expect, test } from "@playwright/test";

test("rota protegida redireciona anônimo para /entrar", async ({ page }) => {
  await page.goto("/obras");
  await expect(page).toHaveURL(/\/entrar/);
});
