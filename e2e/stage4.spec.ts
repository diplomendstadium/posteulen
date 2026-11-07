import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { borrowViaUi, loginViaUi, PASSWORD, registerViaUi } from './account-helpers.ts';
import { allowHomeChange, hatchChicks, makeSick, setGold } from './db-helpers.ts';

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

async function pair(browser: Browser, page: Page) {
  const anna = await registerViaUi(page);
  const otherContext = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const other = await otherContext.newPage();
  const ben = await registerViaUi(other);
  await addContact(page, ben.name);
  await addContact(other, anna.name);
  setGold(anna.name, 300);
  return { anna, ben, other, otherContext };
}

async function buyAndName(page: Page, species: string, name: string): Promise<void> {
  await page.goto('/app/menagerie');
  await page.getByRole('button', { name: `${species} kaufen` }).click();
  await page.getByLabel('Name (2–20 Zeichen)').fill(name);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test.describe('Stufe 4 (SPEC 7, 9.6–9.9, 17.4)', () => {
  test('Leiheule: im Angebot leihen, sie wartet 24 Stunden', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app/menagerie');
    await expect(page.getByTestId('loan-offer')).toHaveCount(3);
    const name = await borrowViaUi(page);
    await expect(page.getByText(/^Heute geliehen: 1 von 3\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schon geliehen' })).toBeDisabled();
    await page.goto('/app/eulen');
    const card = page.getByTestId('owl-card');
    await expect(card).toContainText(name);
    await expect(card).toContainText(/Leiheule – muss bis .* losfliegen/);
    await expect(card.getByRole('button', { name: 'Verschenken' })).toHaveCount(0);
  });

  test('kranke Eule zeigt das grummelige Bild; Eulenarzt und Menagerie', async ({ page }) => {
    const me = await registerViaUi(page);
    setGold(me.name, 300);
    await buyAndName(page, 'Waldkauz', 'Kränkel');
    await buyAndName(page, 'Waldohreule', 'Fleißig');
    makeSick(me.name);
    await page.reload();
    const sick = page.getByTestId('owl-card').filter({ hasText: 'Kränkel' });
    await expect(sick).toContainText('Krank – braucht Pflege oder den Eulenarzt.');
    await expect(sick.getByRole('img')).toHaveAttribute('src', /grumpy/);
    await sick.getByRole('button', { name: 'Zum Eulenarzt (1,0 Gold, 24 Std.)' }).click();
    await expect(sick).toContainText(/Beim Eulenarzt bis/);
    await expect(sick.getByRole('img')).toHaveAttribute('src', /grumpy/);
    await expect(sick.getByRole('button', { name: 'Streicheln' })).toHaveCount(0);

    const other = page.getByTestId('owl-card').filter({ hasText: 'Fleißig' });
    await other.getByRole('button', { name: 'Selbst pflegen (0,2 Gold, 7 Tage)' }).click();
    await expect(other).toContainText(/Wird zu Hause gesund gepflegt/);
    await expect(other.getByRole('button', { name: 'Streicheln' })).toBeVisible();
    await page.goto('/app/finanzen');
    await expect(page.getByRole('cell', { name: 'Behandlung' })).toHaveCount(2);
  });

  test('Küken benennen und eines mit Begleitbrief verschenken', async ({ browser, page }) => {
    const { anna, ben, other, otherContext } = await pair(browser, page);
    hatchChicks(anna.name, 'schleiereule', 2);
    await page.goto('/app/eulen');
    await expect(page.getByRole('heading', { name: 'Wie soll dein Küken heißen?' })).toBeVisible();
    for (const name of ['Flaum', 'Daune']) {
      await page.getByLabel('Name (2–20 Zeichen)').fill(name);
      await page.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Ein Küken verschenken' })).toBeVisible();
    await expect(page.getByTestId('owl-card').first().getByRole('img')).toHaveAttribute(
      'src',
      /chick/,
    );
    await page.getByLabel('Welches Küken?').selectOption({ label: 'Daune' });
    await page.getByLabel('An').selectOption({ label: ben.name });
    await page.getByLabel('Begleitbrief mitgeben (kleines Pergament, kostenlos)').check();
    await page.getByLabel('Begleitbrief', { exact: true }).fill('Für dich, Daune!');
    await page.getByRole('button', { name: 'Verschenken' }).click();
    await expect(page.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'chick');
    await expect(page.getByRole('heading', { name: 'Ein Küken verschenken' })).toHaveCount(0);

    await other.goto('/app/briefe');
    await other.getByRole('link', { name: new RegExp(anna.name) }).click({ timeout: 30_000 });
    await expect(other.getByText('Begleitbrief zum Küken Daune')).toBeVisible({ timeout: 30_000 });
    await expect(other.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'chick');
    await other.goto('/app/eulen');
    await expect(other.getByRole('heading', { name: 'Daune', exact: true })).toBeVisible();
    await expect(other.getByText(/Küken – erwachsen am/)).toBeVisible();
    await otherContext.close();
  });

  test('Name und Wohnort ändern', async ({ browser, page }) => {
    const { anna, other, otherContext } = await pair(browser, page);
    await page.goto('/app/einstellungen');
    const newName = `${anna.name.slice(0, 15)} Neu`;
    await page.getByLabel('Neuer Name').fill(newName);
    await page.getByRole('button', { name: 'Namen ändern' }).click();
    await expect(page.getByText(`Du heißt jetzt ${newName}.`)).toBeVisible();
    await expect(
      page.getByText('Du kannst deinen Namen erst im nächsten Kalenderjahr wieder ändern.').first(),
    ).toBeVisible();
    await other.goto('/app/briefe/system');
    await expect(other.getByText(`${anna.name} heißt jetzt ${newName}.`)).toBeVisible();

    // v0.2: three moves per calendar month, the choice at registration does not count.
    await expect(page.getByText('Diesen Monat noch 3-mal möglich.')).toBeVisible();
    allowHomeChange(newName);
    await page.reload();
    const map = page.getByRole('application', { name: 'Karte von Westeuropa' });
    await map.focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Gewählt:/)).toBeVisible();
    await page.getByRole('button', { name: 'Wohnort übernehmen' }).click();
    await expect(page.getByText('Dein neuer Wohnort ist gespeichert.')).toBeVisible();
    await expect(page.getByText('Diesen Monat noch 2-mal möglich.')).toBeVisible();
    await otherContext.close();
  });

  test('Konto löschen und innerhalb von 24 Stunden zurückholen', async ({ page }) => {
    const me = await registerViaUi(page);
    await page.goto('/app/einstellungen');
    await page.getByLabel('Passwort zur Bestätigung').fill(PASSWORD);
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Konto löschen' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await loginViaUi(page, me.name, PASSWORD);
    await expect(
      page.getByText('Willkommen zurück! Die Löschung deines Kontos wurde abgebrochen.'),
    ).toBeVisible({
      timeout: 30_000,
    });
    await page.goto('/app/briefe/system');
    await expect(page.getByText('Die Löschung deines Kontos wurde abgebrochen.')).toBeVisible();
  });
});
