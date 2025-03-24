import { getCookie} from '$lib/utils/user';
import { beforeEach, describe, it, expect } from 'vitest';

describe('getCookie', () => {
	beforeEach(() => {
		document.cookie = '';
	});

	it('should return undefined if the cookie does not exist', () => {
		expect(getCookie('cookieName')).toBeUndefined();
	});

	it('should return the cookie value when cookie exists', () => {
		document.cookie = 'myCookie=testValue; path=/';
		expect(getCookie('myCookie')).toBe('testValue');
	});
});
