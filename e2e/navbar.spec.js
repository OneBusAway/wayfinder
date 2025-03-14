import { test, expect } from '@playwright/test';

test.describe('Navigation Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:4173/', { timeout: 60000, waitUntil: 'domcontentloaded' });
	});

	test('should display all navigation links', async ({ page }) => {
		const links = ['Home', 'About', 'Contact', 'Fares & Tolls'];
		for (const link of links) {
			await expect(page.getByRole('link', { name: link })).toBeVisible();
		}
	});

	test('should navigate to Home page on click', async ({ page }) => {
		await page.getByRole('link', { name: 'Home' }).click();
		await expect(page).toHaveURL(/(\/|\/home)$/);
	});

	test('should navigate to About page on click', async ({ page }) => {
		await page.getByRole('link', { name: 'About' }).click();
		await expect(page).toHaveURL(/.*about/);
	});

	test('should navigate to Contact page on click', async ({ page }) => {
		await page.getByRole('link', { name: 'Contact' }).click();
		await expect(page).toHaveURL(/.*contact/);
	});

	test('should navigate to Fares & Tolls page on click', async ({ page }) => {
		await page.getByRole('link', { name: 'Fares & Tolls' }).click();
		await expect(page).toHaveURL(/.*fares-and-tolls/);
	});

	test('should redirect to home when clicking the logo', async ({ page }) => {
		const logo = page.getByRole('link', { name: 'Puget Sound' }).first();
		await logo.click();
		await expect(page).toHaveURL('http://localhost:4173/');
	});
});
