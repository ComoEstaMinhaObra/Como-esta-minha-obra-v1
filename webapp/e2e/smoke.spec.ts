import { expect, test } from "@playwright/test";

test.describe("smoke marketing + guards (sem auth)", () => {
  test("landing carrega", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Como Está Minha Obra").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Da fundação à entrega/i }),
    ).toBeVisible();
  });

  test("preços carrega", async ({ page }) => {
    await page.goto("/precos");
    await expect(page.getByRole("heading", { name: "Preços" })).toBeVisible();
  });

  test("blog lista e post", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();
    await page
      .getByRole("link", {
        name: /Como acompanhar a obra da sua casa sem depender do WhatsApp/i,
      })
      .click();
    await expect(page).toHaveURL(/\/blog\/como-acompanhar-obra-sem-whatsapp/, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", {
        name: /Como acompanhar a obra da sua casa sem depender do WhatsApp/i,
      }),
    ).toBeVisible();
  });

  test("termos e política carregam", async ({ page }) => {
    await page.goto("/termos");
    await expect(
      page.getByRole("heading", { name: "Termos de uso" }),
    ).toBeVisible();
    await page.goto("/politica-de-privacidade");
    await expect(
      page.getByRole("heading", { name: "Política de privacidade" }),
    ).toBeVisible();
  });

  test("/obras redireciona anônimo para /entrar", async ({ page }) => {
    await page.goto("/obras");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("/admin redireciona anônimo para /entrar", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("CSP Report-Only propaga o mesmo nonce aos scripts do Next", async ({
    page,
  }) => {
    const response = await page.goto("/entrar");
    const csp = response?.headers()["content-security-policy-report-only"];
    expect(csp).toBeTruthy();
    const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    const scripts = await page
      // Este elemento só existe no `next dev` e nunca integra o HTML da aplicação.
      .locator("script:not([data-nextjs-dev-overlay])")
      .evaluateAll((elementos) => elementos.map((elemento) => elemento.nonce));
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.every((scriptNonce) => scriptNonce === nonce)).toBe(true);
  });

  test("robots e sitemap respondem", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const xml = await sitemap.text();
    expect(xml).toContain("/blog");
  });
});
