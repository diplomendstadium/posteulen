import type { Page } from '@playwright/test';
import { SPECIES } from '@posteulen/shared/species.ts';
import { expect, test } from './fixtures.ts';
import { loginViaUi, PASSWORD, registerViaUi } from './account-helpers.ts';
import { setGold } from './db-helpers.ts';

/**
 * v0.3: no text stands directly on the world-map background. Returns every visible text whose
 * nearest painted ancestor is the page itself (map labels inside the SVG excepted).
 */
async function unboxedTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!node.textContent?.trim() || !element || seen.has(element)) continue;
      seen.add(element);
      if (element.closest('svg, .visually-hidden, dialog:not([open])')) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (getComputedStyle(element).visibility === 'hidden') continue;
      let painted = false;
      for (let a: Element | null = element; a && a !== document.body; a = a.parentElement) {
        const style = getComputedStyle(a);
        if (
          (style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
            style.backgroundColor !== 'transparent') ||
          style.backgroundImage !== 'none'
        ) {
          painted = true;
          break;
        }
      }
      if (!painted)
        out.push(`${element.tagName.toLowerCase()}: ${node.textContent.trim().slice(0, 50)}`);
    }
    return out;
  });
}

test.describe('Version 0.3', () => {
  test('alle Texte stehen in Boxen, dahinter die Weltkarte', async ({ page }) => {
    for (const path of ['/', '/konto-erstellen', '/hilfe', '/datenschutz', '/impressum']) {
      await page.goto(path);
      await expect(page.locator('main, .start, .page').first()).toBeVisible();
      // Let every request finish before moving on (Firefox reports aborted ones as errors).
      await page.waitForLoadState('networkidle');
      expect(await unboxedTexts(page), path).toEqual([]);
    }
    // The faded world map lies behind every page.
    expect(
      await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage),
    ).toContain('world-map');
    await registerViaUi(page);
    await page.waitForLoadState('networkidle');
    expect(await unboxedTexts(page), '/willkommen').toEqual([]);
    // A chat (here with the Erklärbär) with header, hints and letter sheets.
    await page.goto('/app/briefe');
    await page.getByRole('link', { name: /Erklärbär/ }).click();
    await expect(page.locator('li.letter').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await unboxedTexts(page), 'Chat').toEqual([]);
    for (const path of [
      '/app',
      '/app/briefe',
      '/app/briefe/system',
      '/app/adressbuch',
      '/app/eulen',
      '/app/menagerie',
      '/app/karte',
      '/app/finanzen',
      '/app/einstellungen',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeAttached();
      await page.waitForLoadState('networkidle');
      expect(await unboxedTexts(page), path).toEqual([]);
    }
  });

  test('Briefbogen auf Pergament; gelesen gilt sofort, auch ohne Neuladen', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app');
    const newPost = page.getByRole('link', { name: /Neue Post!/ });
    await expect(newPost).toBeVisible();
    await page.locator('nav a[href="/app/briefe"]').last().click();
    const explainer = page.getByRole('link', { name: /Erklärbär/ });
    await expect(explainer).toContainText('1 ungelesen');
    await explainer.click();
    const letter = page.locator('li.letter').first();
    // v0.3.2: parchment texture instead of the seal.
    await expect(letter.locator('.seal')).toHaveCount(0);
    expect(
      await letter.locator('.sheet').evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain('parchment-light');
    expect(
      await letter.locator('p.text').evaluate((el) => getComputedStyle(el).fontFamily),
    ).toMatch(/Playwrite DE Grund/);
    // The old hint about the bot's reply time is gone (v0.3).
    await expect(page.getByText(/Der Bot antwortet etwa zwei Stunden/)).toHaveCount(0);
    // Back via the bottom bar: the counter is gone at once, without a reload.
    await page.locator('nav a[href="/app/briefe"]').last().click();
    await expect(page.getByRole('link', { name: /Erklärbär/ })).not.toContainText('ungelesen');
    // Read whatever else has arrived meanwhile (the aunt writes after 5 minutes, sped up here),
    // always returning via the bottom bar: "Neue Post!" disappears without a reload.
    const unread = page.locator('ul.chats a').filter({ hasText: 'ungelesen' });
    while ((await unread.count()) > 0) {
      await unread.first().click();
      await expect(page).toHaveURL(/\/app\/briefe\/.+/);
      await page.waitForLoadState('networkidle');
      await page.locator('nav a[href="/app/briefe"]').last().click();
      await expect(page).toHaveURL(/\/app\/briefe$/);
    }
    await expect(newPost).toHaveCount(0);
  });

  test('Benachrichtigungs-Hinweis lässt sich bis zur nächsten Anmeldung ausblenden', async ({
    page,
  }) => {
    const { name } = await registerViaUi(page);
    await page.goto('/app');
    const hint = page.getByRole('link', {
      name: /Benachrichtigungen sind noch nicht eingerichtet/,
    });
    await expect(hint).toBeVisible();
    await page.getByRole('button', { name: 'Ausblenden bis zur nächsten Anmeldung' }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeAttached();
    await expect(hint).toHaveCount(0);
    await page.goto('/app/einstellungen');
    await page.getByRole('button', { name: 'Abmelden' }).last().click();
    await expect(page).toHaveURL(/\/$/);
    await loginViaUi(page, name, PASSWORD);
    await expect(hint).toBeVisible({ timeout: 30_000 });
  });

  test('Menagerie: Leiheulen oben, Kaufeulen nach Preis mit Beschreibung, lange Namen passen', async ({
    page,
  }) => {
    await registerViaUi(page);
    await page.goto('/app/menagerie');
    const loan = page.getByRole('heading', { name: 'Eulen leihen' });
    const buy = page.getByRole('heading', { name: 'Eulen kaufen' });
    await expect(buy).toBeVisible();
    expect((await loan.boundingBox())!.y).toBeLessThan((await buy.boundingBox())!.y);
    const cards = page.locator('ul.for-sale > li');
    const byPrice = [...SPECIES].sort(
      (a, b) => a.price - b.price || a.name.localeCompare(b.name, 'de'),
    );
    await expect(cards.locator('h3')).toHaveText(byPrice.map((species) => species.name));
    await expect(cards.first().locator('.description')).toContainText('Haselnüsse');
    // Loan owls carry no description.
    await expect(page.getByTestId('loan-offer').locator('.description')).toHaveCount(0);
    // The picture stays as wide as the card; the long name stays inside it.
    const card = cards.filter({ hasText: 'Südliche Weißgesichtseule' });
    const cardBox = (await card.boundingBox())!;
    const imageBox = (await card.locator('img').boundingBox())!;
    expect(imageBox.width).toBeGreaterThan(cardBox.width * 0.8);
    const fits = await card
      .locator('h3')
      .evaluate(
        (el) =>
          el.scrollWidth <= el.clientWidth + 1 &&
          el.getBoundingClientRect().right <=
            (el.parentElement?.getBoundingClientRect().right ?? 0) + 1,
      );
    expect(fits).toBe(true);
  });

  test('Eulen: Leiheulen über den eigenen, Freilassen nur mit Namen und zweiter Bestätigung', async ({
    page,
  }) => {
    const { name } = await registerViaUi(page);
    setGold(name, 300);
    await page.goto('/app/menagerie');
    await page.getByTestId('loan-offer').first().getByRole('button').click();
    await expect(page.getByText(/wartet jetzt bei deinen Eulen/)).toBeVisible();
    // v0.7.1: a purchase is confirmed first.
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Waldkauz kaufen' }).click();
    await expect(page).toHaveURL(/\/app\/eulen$/);
    await page.getByLabel('Name (2–20 Zeichen)').fill('Federchen');
    await page.getByRole('button', { name: 'Speichern' }).click();
    const loans = page.getByRole('heading', { name: 'Leiheulen', level: 2 });
    const own = page.getByRole('heading', { name: 'Deine Eulen', level: 2 });
    await expect(own).toBeVisible();
    expect((await loans.boundingBox())!.y).toBeLessThan((await own.boundingBox())!.y);

    const card = page.getByTestId('owl-card').filter({ hasText: 'Federchen' });
    await card.getByRole('button', { name: 'In die Freiheit entlassen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Federchen in die Freiheit entlassen' });
    await expect(dialog).toBeVisible();
    const next = dialog.getByRole('button', { name: 'Weiter' });
    await expect(next).toBeDisabled();
    const field = dialog.getByLabel(/Tippe zur Bestätigung den Namen/);
    await field.fill('federchen');
    await expect(next).toBeDisabled();
    await field.fill('Federchen');
    await next.click();
    await expect(dialog.getByText(/Bist du ganz sicher\?/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Ja, Federchen endgültig freilassen' }).click();
    await expect(page.getByText('Federchen ist in die Freiheit geflogen.')).toBeVisible();
    await expect(page.getByTestId('owl-card').filter({ hasText: 'Federchen' })).toHaveCount(0);
  });

  test('Startseite mit Gruppenbild; Willkommen erklärt den Weg ohne App-Store', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('img', { name: /Siebzehn Posteulen/ })).toBeVisible();
    await registerViaUi(page);
    await expect(page.getByRole('heading', { name: 'Eine App ganz ohne App-Store' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Android-Handy mit Chrome' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'iPhone oder iPad mit Safari' })).toBeVisible();
    await expect(page.getByText(/klingelt der Briefkasten ja auch nicht/)).toBeVisible();
    await expect(page.getByText(/UnifiedPush|IronFox|Google-Dienste/)).toHaveCount(0);
  });
});
