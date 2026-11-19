/**
 * Version 1.2.4 in the browser: pictures before signing in by the device's clock and time
 * zone, the costs and the donation link in the info text, the kilometres of own owls, the
 * welcome and the descriptions in the post office, the notifications at the top of the
 * settings and no "Neue Post!" for system messages.
 */
import { registerViaUi } from './account-helpers.ts';
import { onlySystemUnread, setGold } from './db-helpers.ts';
import { expect, test } from './fixtures.ts';

test.describe('Version 1.2.4', () => {
  test('Startseite: Bilder nach Uhr und Zeitzone des Geräts, Kosten und Spendenlink', async ({
    browser,
  }) => {
    // 12:00 in Berlin is 22:00 in Sydney: night there, whatever the hour in Berlin.
    const context = await browser.newContext({ locale: 'de-DE', timezoneId: 'Australia/Sydney' });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-11-18T12:00:00+01:00'));
    await page.goto('/');
    await expect(page.locator('figure.group')).toHaveAttribute('data-scene', 'groupNight');
    const about = page.getByTestId('about');
    await expect(
      about.locator('figure[data-scene="suedliche-weissgesichtseule-homeNight"]'),
    ).toBeVisible();
    await expect(about.locator('figure')).toHaveCount(5);
    await expect(about.locator('strong', { hasText: 'keine In-App-Käufe' })).toBeVisible();
    await expect(about.getByRole('heading', { name: 'Wer bezahlt das eigentlich?' })).toBeVisible();
    await expect(about.getByRole('link', { name: 'Spende', exact: true })).toHaveAttribute(
      'href',
      'https://ko-fi.com/posteulen',
    );
    // Christmas season by the device's calendar (Sydney is already on 5 December).
    await page.clock.setFixedTime(new Date('2026-12-04T20:00:00+01:00'));
    await page.reload();
    await expect(page.locator('figure.group')).toHaveAttribute('data-scene', /^groupXmas/);
    await context.close();
  });

  test('Eulen mit Kilometern, Postamt mit Begrüßung, Einstellungen, keine „Neue Post!“ für Systemnachrichten', async ({
    page,
  }) => {
    const { name } = await registerViaUi(page);
    setGold(name, 300);
    await page.goto('/app/menagerie/innen');
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Waldkauz kaufen' }).click();
    await page.getByLabel('Name (2–20 Zeichen)').fill('Federchen');
    await page.getByRole('button', { name: 'Speichern' }).click();
    const card = page.getByTestId('owl-card').filter({ hasText: 'Federchen' });
    await expect(card.locator('p.species')).toHaveText(/^Waldkauz · (weiblich|männlich) · 0 km$/);

    await page.goto('/app/postamt/innen');
    await expect(page.getByTestId('loan-welcome')).toHaveText(
      /^Herzlich willkommen! Möchtest du eine Eule leihen\? Im Moment sind unser.* und unser.* reisebereit\.$/,
    );
    await expect(page.getByText(/Heute im Angebot/)).toHaveCount(0);
    const offers = page.getByTestId('loan-offer');
    await expect(offers).toHaveCount(5);
    for (const offer of await offers.all())
      await expect(offer.locator('.description')).toBeVisible();
    // A loan owl has no kilometres.
    await offers.first().getByRole('button').click();
    await expect(page.getByText(/wartet jetzt hier und bei deinen Eulen/)).toBeVisible();
    await expect(page.getByTestId('owl-card').first().locator('p.species')).not.toContainText('km');

    await page.goto('/app/einstellungen');
    await expect(page.locator('main h2').nth(1)).toHaveText('Benachrichtigungen');

    // Letters bring "Neue Post!", system messages only their counter in the letters list.
    onlySystemUnread(name);
    await page.goto('/app/briefe');
    await expect(page.getByRole('link', { name: /Systemnachrichten/ })).toContainText(
      '1 ungelesen',
    );
    await expect(page.getByRole('link', { name: /Neue Post!/ })).toHaveCount(0);
  });
});
