import { expect, test } from './fixtures.ts';
import { borrowViaUi, registerViaUi } from './account-helpers.ts';

test.describe('Bots (Stufe 5, SPEC 10)', () => {
  test('Erklärbär-Brief liegt bereit, Bot-Hinweise, Brief an einen Bot, Bot entfernen', async ({
    page,
  }) => {
    await registerViaUi(page);
    await page.goto('/app/briefe');
    const chat = page.getByRole('link', { name: /Erklärbär/ });
    await expect(chat).toContainText('Bot');
    await expect(chat).toContainText('1 ungelesen');
    await chat.click();
    await expect(page.getByText(/Hallo und willkommen bei PostEulen!/)).toBeVisible();
    await expect(page.getByTestId('bot-notice')).toContainText('nicht Ende-zu-Ende-verschlüsselt');
    await expect(page.getByText(/TelefonSeelsorge Deutschland 0800 111 0 111/)).toBeVisible();
    // No safety number and no recipients list for bots.
    await expect(page.getByText('Weiteren Empfänger hinzufügen')).toHaveCount(0);

    await borrowViaUi(page);
    // v0.7.2: bots are not in the address book; they are written to in their chat.
    await page.goto('/app/adressbuch');
    await expect(page.getByText(/Erklärbär|Tante/)).toHaveCount(0);
    await page.goto('/app/briefe');
    await expect(page.getByRole('link', { name: /Tante \S+/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: /Erklärbär/ }).click();
    await page.getByLabel('Text').fill('Wie füttere ich meine Eule?');
    await page.getByRole('button', { name: 'Eule wählen' }).click();
    await expect(page.getByText(/Ankunft bei Erklärbär/)).toBeVisible();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Wie füttere ich meine Eule?')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Diesem Bot kannst du wieder ab .* schreiben/)).toBeVisible({
      timeout: 30_000,
    });

    // Removing a bot is final – a single one in its chat …
    await page.goto('/app/briefe');
    await page.getByRole('link', { name: /Tante \S+/ }).click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: /^Tante \S+ entfernen$/ }).click();
    await expect(page).toHaveURL(/\/app\/briefe$/);
    await expect(page.getByRole('link', { name: /Tante/ })).toHaveCount(0);
    await page.goto('/app/karte');
    await expect(page.getByText(/Erklärbär \(Bot\)/)).toBeAttached();
    // … all of them in the settings (v0.7.2).
    await page.goto('/app/einstellungen');
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Alle Bots entfernen' }).click();
    await expect(page.getByTestId('bot-settings')).toContainText('Alle Bots sind entfernt.');
    await page.goto('/app/briefe');
    await expect(page.getByRole('link', { name: /Erklärbär/ })).toHaveCount(0);
  });
});
