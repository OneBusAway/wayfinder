import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UmamiAdapter } from '$lib/Analytics/adapters/UmamiAdapter.js';

const fullEnv = {
	PUBLIC_ANALYTICS_DOMAIN: 'example.com',
	PUBLIC_ANALYTICS_API_HOST: 'https://umami.example.com',
	PUBLIC_ANALYTICS_WEBSITE_ID: '79eab5f4-0c4d-492b-9b60-ecf018859f03'
};

const envelope = {
	name: 'pageview',
	url: '/test',
	referrer: 'https://referrer.example.com',
	title: 'Test Page',
	language: 'en-US',
	screen: '1920x1080',
	props: { id: '1_00' }
};

const ctx = { userAgent: 'TestAgent/1.0', clientIp: '203.0.113.42' };

describe('UmamiAdapter.isEnabled', () => {
	it('returns true when domain, api host, and website id are all set', () => {
		expect(new UmamiAdapter(fullEnv).isEnabled()).toBe(true);
	});

	it('returns false when website id is missing', () => {
		expect(
			new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_WEBSITE_ID: '' }).isEnabled()
		).toBe(false);
	});

	it('returns false when api host is missing', () => {
		expect(
			new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' }).isEnabled()
		).toBe(false);
	});

	it('returns false when domain is missing', () => {
		expect(
			new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' }).isEnabled()
		).toBe(false);
	});
});

describe('UmamiAdapter construction-time config warning', () => {
	let warnSpy;
	beforeEach(() => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		warnSpy.mockRestore();
	});

	it('does not warn when fully configured', () => {
		new UmamiAdapter(fullEnv);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('warns once when website id is missing', () => {
		new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_WEBSITE_ID: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('UmamiAdapter: missing PUBLIC_ANALYTICS_WEBSITE_ID')
		);
	});

	it('warns when api host is missing', () => {
		new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_API_HOST: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('UmamiAdapter: missing PUBLIC_ANALYTICS_API_HOST')
		);
	});

	it('warns when domain is missing', () => {
		new UmamiAdapter({ ...fullEnv, PUBLIC_ANALYTICS_DOMAIN: '' });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('UmamiAdapter: missing PUBLIC_ANALYTICS_DOMAIN')
		);
	});
});
