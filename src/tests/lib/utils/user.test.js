import { getCookie, getUserId } from '$lib/utils/user';
import { beforeEach, describe, it, expect, afterEach } from 'vitest';

describe('getCookie', () => {
	beforeEach(() => {
		document.cookie = 'userId=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
	});

	afterEach(() => {
		document.cookie = '';
	});

	it('should return undefined if the cookie does not exist', () => {
		expect(getCookie('cookieName')).toBeUndefined();
	});

	it('should return the cookie value when cookie exists', () => {
		document.cookie = 'myCookie=testValue; path=/';
		expect(getCookie('myCookie')).toBe('testValue');
	});

	it('should handle cookies with spaces in the value', () => {
		document.cookie = 'myCookie=value with spaces; path=/';
		expect(getCookie('myCookie')).toBe('value with spaces');
	});

	it('should handle cookies with special characters in the value', () => {
		document.cookie = 'myCookie=value!@#$%^&*(); path=/';
		expect(getCookie('myCookie')).toBe('value!@#$%^&*()');
	});

	it('should handle cookies with multiple values', () => {
		document.cookie = 'myCookie=value1; path=/';
		document.cookie = 'myCookie=value2; path=/';
		expect(getCookie('myCookie')).toBe('value2');
	});
});

describe('getUserId', () => {
	beforeEach(() => {
		document.cookie = 'userId=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
	});

	it('should generate a new userId if no cookie exists', () => {
		const userId = getUserId();
		expect(userId).toBeDefined();
		expect(userId).toMatch(/^[0-9a-fA-F-]{36}/);
	});

	it('should return the existing userId if a cookie exists', () => {
		document.cookie = 'userId=testUserId; path=/';
		const userId = getUserId();
		expect(userId).toBe('testUserId');
	});

	it('should set a new cookie with the generated userId if no cookie exists', () => {
		const testUserId = getUserId();
		const testRegex = new RegExp(`userId=${testUserId}`);
		expect(document.cookie).toMatch(testRegex);
	});

	it('should not set a new cookie if a cookie already exists', () => {
		const testUserId = crypto.randomUUID();
		const testRegex = new RegExp(`userId=${testUserId}`);
		document.cookie = `userId=${testUserId}; path=/; max-age=31536000`;
		getUserId();
		expect(document.cookie).toMatch(testRegex);
	});
});
