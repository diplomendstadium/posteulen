import type { Page } from '@playwright/test';
import { ADMIN_URL, BOTS_URL, expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { expectAccessible } from './a11y-helpers.ts';
import { setGold } from './db-helpers.ts';

test.describe('Hilfe, Datenschutz, Impressum (SPEC 8.11)', () => {
  test('Hilfe vor dem Login: Inhaltsverzeichnis, Sprungmarken, FAQ, Krisenhilfe', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Hilfe' }).click();
    await expect(page).toHaveURL(/\/hilfe$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hilfe');
    const contents = page.getByRole('navigation', { name: 'Inhalt' });
    await contents.getByRole('link', { name: 'Benachrichtigungen' }).click();
    await expect(page).toHaveURL(/\/hilfe#benachrichtigungen$/);
    await expect(page.locator('#benachrichtigungen')).toBeInViewport();
    await expect(page.getByText(/IronFox oder Fennec \(F-Droid\)/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Häufige Fragen' })).toBeVisible();
    await expect(
      page.getByText('TelefonSeelsorge Deutschland 0800 111 0 111').first(),
    ).toBeVisible();
    // Opened directly with an anchor, the section is shown as well.
    await page.goto('/hilfe#kueken');
    await expect(page.locator('#kueken')).toBeInViewport();
    // A malformed fragment is ignored without an error (the guard checks the console).
    await page.goto('/hilfe#%E0%A4%A');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hilfe');
  });

  test('Datenschutz ohne Entwurfshinweis, Impressum mit Mastodon-Link', async ({ page }) => {
    await page.goto('/datenschutz');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutz');
    await expect(page.getByText(/genau ein Cookie/)).toBeVisible();
    await expect(page.getByText(/OpenAI/).first()).toBeVisible();
    await page.goto('/impressum');
    await expect(page.getByText(/technisches Experiment für den Eigengebrauch/)).toBeVisible();
    const mastodon = page.getByRole('link', { name: 'https://23.social/@iak' });
    await expect(mastodon).toHaveAttribute('target', '_blank');
    await expect(mastodon).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    await expect(page.getByText(/keinerlei Haftung/)).toBeVisible();
  });

  test('Hilfe nach dem Login und Link aus der Willkommensseite', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/willkommen');
    await page.getByRole('link', { name: 'Noch Fragen? Die Hilfe erklärt alles in Ruhe' }).click();
    await expect(page).toHaveURL(/\/hilfe#installieren$/);
    await expect(page.locator('#installieren')).toBeInViewport();
    await page.goto('/app');
    await page.getByRole('link', { name: 'Hilfe', exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hilfe');
    await page.getByRole('link', { name: '← Zurück' }).click();
    await expect(page).toHaveURL(/\/app$/);
  });
});

test.describe('Barrierefreiheit (SPEC 14)', () => {
  test('öffentliche Seiten und Verwaltung', async ({ page }) => {
    for (const path of [
      '/',
      '/konto-erstellen',
      '/hilfe',
      '/datenschutz',
      '/impressum',
      '/gibt-es-nicht',
    ]) {
      await page.goto(path);
      await expectAccessible(page, path);
    }
    await page.goto(ADMIN_URL);
    await expectAccessible(page, 'Verwaltung');
    // v0.8: the bots control centre.
    await page.goto(BOTS_URL);
    await expect(
      page.getByRole('heading', { name: 'Anmeldung im Bots-Kontrollzentrum' }),
    ).toBeVisible();
    await expectAccessible(page, 'Bots-Kontrollzentrum');
  });

  test('alle Bereiche nach dem Login', async ({ page }) => {
    test.setTimeout(120_000);
    await registerViaUi(page);
    await expectAccessible(page, '/willkommen');
    for (const path of [
      '/app',
      '/app/briefe',
      '/app/briefe/system',
      '/app/eulen',
      '/app/menagerie',
      '/app/finanzen',
      '/app/adressbuch',
      '/app/karte',
      '/app/einstellungen',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectAccessible(page, path);
    }
    await page.goto('/app/briefe');
    await page
      .getByRole('link', { name: /Erklärbär/ })
      .first()
      .click();
    await expect(page.getByText(/nicht Ende-zu-Ende-verschlüsselt/)).toBeVisible();
    await expectAccessible(page, 'Chat mit dem Erklärbären');
  });
});

/** Elements whose own text contains `needle` and that use the decorative heading font. */
async function inDisplayFont(page: Page, needle: string, scope = 'body'): Promise<string[]> {
  return page.evaluate(
    ({ text, root }) =>
      [...document.querySelectorAll(`${root} *`)]
        .filter((element) =>
          [...element.childNodes].some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes(text),
          ),
        )
        .filter((element) => getComputedStyle(element).fontFamily.includes('Cinzel'))
        .map((element) => `${element.tagName}.${element.className}: ${element.textContent ?? ''}`),
    { text: needle, root: scope },
  );
}

test('Nutzer-, Bot- und Eulennamen nie in der Zierschrift (SPEC 7.1, 14)', async ({ page }) => {
  const me = await registerViaUi(page);
  setGold(me.name, 100);
  await page.goto('/app/menagerie');
  // v0.7.1: a purchase is confirmed first.
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Waldkauz kaufen' }).click();
  await page.getByLabel('Name (2–20 Zeichen)').fill('Waldi');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.getByRole('heading', { name: 'Waldi', exact: true }).waitFor();
  expect(await inDisplayFont(page, 'Waldi'), 'Eulenübersicht').toEqual([]);
  await page.getByTestId('owl-card').first().getByRole('button', { name: 'Streicheln' }).click();
  await page.getByTestId('owl-overlay').waitFor();
  expect(await inDisplayFont(page, 'Waldi'), 'Einblendung').toEqual([]);
  await page.keyboard.press('Escape');
  await page.goto('/app/menagerie');
  await page.getByTestId('loan-offer').first().waitFor();
  const loanName = (await page.getByTestId('loan-offer').first().locator('h3').textContent()) ?? '';
  expect(loanName).not.toBe('');
  // Only within the offer: a loan name may be part of a species name ("Brille" in "Brillenkauz").
  expect(await inDisplayFont(page, loanName, '[data-testid="loan-offer"]'), 'Leihangebot').toEqual(
    [],
  );
  // v0.7.2: bots are not in the address book; the settings name them ("Alle Bots entfernen").
  for (const path of ['/app/briefe', '/app/einstellungen']) {
    await page.goto(path);
    await page.getByText('Erklärbär').first().waitFor();
    expect(await inDisplayFont(page, 'Erklärbär'), path).toEqual([]);
  }
});
