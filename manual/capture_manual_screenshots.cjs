const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const outDir = path.resolve(__dirname, 'prints');
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = 'http://localhost';
const stamp = Date.now();
const demo = {
  name: 'Marcela',
  email: `manual.${stamp}@cafefinance.local`,
  password: 'Manual123',
};

async function waitForApp(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function screenshot(page, fileName, fullPage = false) {
  await waitForApp(page);
  await page.screenshot({ path: path.join(outDir, fileName), fullPage });
}

async function clickText(page, text) {
  await page.getByText(text, { exact: false }).first().click();
}

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(baseUrl);
  await screenshot(page, '01-login.png');

  await page.goto(`${baseUrl}/cadastro`);
  await screenshot(page, '02-cadastro.png');

  await page.locator('input[formcontrolname="name"], input[placeholder*="nome" i]').first().fill(demo.name);
  await page.locator('input[formcontrolname="email"], input[type="email"]').first().fill(demo.email);
  const passwordInputs = await page.locator('input[type="password"]').all();
  await passwordInputs[0].fill(demo.password);
  await passwordInputs[1].fill(demo.password);
  await page.getByRole('button', { name: /criar conta/i }).click();
  await page.waitForURL(/perfil|home|movimentacoes/, { timeout: 20000 }).catch(() => {});
  await waitForApp(page);

  await page.goto(`${baseUrl}/movimentacoes`);
  await waitForApp(page);
  await page.locator('input[type="text"]').first().fill('240000');
  await page.locator('input[type="text"]').first().dispatchEvent('input');
  await page.getByRole('button', { name: /salvar entrada/i }).click().catch(async () => {
    await page.locator('button').filter({ hasText: /salvar entrada/i }).first().click();
  });
  await waitForApp(page);

  await page.locator('button').filter({ hasText: /saída/i }).first().click().catch(async () => {
    await page.getByText('Saída', { exact: false }).first().click();
  });
  await page.locator('input[type="text"]').first().fill('15000');
  await page.locator('input[type="text"]').first().dispatchEvent('input');
  await clickText(page, 'Aluguel').catch(() => {});
  const textarea = page.locator('textarea').first();
  if (await textarea.count()) {
    await textarea.fill('Despesa mensal');
  }
  await page.locator('button').filter({ hasText: /salvar saída/i }).first().click().catch(async () => {
    await page.getByRole('button', { name: /salvar saída/i }).click();
  });
  await waitForApp(page);

  await page.goto(`${baseUrl}/perfil`);
  await screenshot(page, '03-perfil.png');

  await page.goto(`${baseUrl}/movimentacoes`);
  await waitForApp(page);
  await screenshot(page, '04-movimentacoes.png');

  await page.goto(`${baseUrl}/home`);
  await screenshot(page, '05-relatorios.png', true);

  await page.goto(`${baseUrl}/economias`);
  await waitForApp(page);
  await page.locator('input').nth(0).fill('Reserva de emergencia');
  await page.locator('input').nth(1).fill('50000');
  await page.locator('input').nth(1).dispatchEvent('input');
  await page.getByRole('button', { name: /criar meta/i }).click().catch(async () => {
    await page.locator('button').filter({ hasText: /criar meta/i }).first().click();
  });
  await waitForApp(page);
  await screenshot(page, '06-economias.png', true);

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'demo-account.txt'), `${demo.email}\n${demo.password}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
