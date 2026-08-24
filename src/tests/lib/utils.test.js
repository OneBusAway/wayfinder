import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { debounce, removeAgencyPrefix, routeShortNamesForStop } from '$lib/utils';

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should call the function only once after the wait time', async () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 100);

		debouncedFn();
		expect(mockFn).not.toBeCalled();

		vi.advanceTimersByTime(50);
		expect(mockFn).not.toBeCalled();

		vi.advanceTimersByTime(50);
		expect(mockFn).toBeCalledTimes(1);
	});

	it('should reset the timer when called again before wait time', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 100);

		debouncedFn();
		vi.advanceTimersByTime(50);
		debouncedFn();
		vi.advanceTimersByTime(50);
		expect(mockFn).not.toBeCalled();

		vi.advanceTimersByTime(50);
		expect(mockFn).toBeCalledTimes(1);
	});

	it('should pass arguments to the debounced function', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 100);

		debouncedFn('test', 123);
		vi.advanceTimersByTime(100);

		expect(mockFn).toBeCalledWith('test', 123);
	});

	it('should pass the latest arguments when called multiple times', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 100);

		debouncedFn('first', 1);
		vi.advanceTimersByTime(50);

		debouncedFn('second', 2);
		vi.advanceTimersByTime(100);

		expect(mockFn).toBeCalledTimes(1);
		expect(mockFn).toBeCalledWith('second', 2);
	});

	it('should maintain correct context (this binding)', () => {
		const context = {
			value: 'test',
			method: vi.fn(function () {
				return this.value;
			})
		};

		const debouncedMethod = debounce(context.method, 100);
		context.debouncedMethod = debouncedMethod;

		context.debouncedMethod();
		vi.advanceTimersByTime(100);

		expect(context.method).toBeCalledTimes(1);
		expect(context.method.mock.results[0].value).toBe('test');
	});

	it('should handle zero wait time', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 0);

		debouncedFn();
		vi.advanceTimersByTime(0);

		expect(mockFn).toBeCalledTimes(1);
	});

	it('should handle multiple rapid calls', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 100);

		debouncedFn();
		debouncedFn();
		debouncedFn();
		debouncedFn();
		debouncedFn();

		vi.advanceTimersByTime(100);

		expect(mockFn).toBeCalledTimes(1);
	});

	it('cancels a queued invocation', () => {
		const mockFn = vi.fn();
		const debouncedFn = debounce(mockFn, 100);

		debouncedFn();
		debouncedFn.cancel();
		vi.advanceTimersByTime(100);

		expect(mockFn).not.toHaveBeenCalled();
	});
});

describe('removeAgencyPrefix', () => {
	it('should remove agency prefix from ID strings', () => {
		expect(removeAgencyPrefix('MTS_41242')).toBe('41242');
		expect(removeAgencyPrefix('1_75403')).toBe('75403');
		expect(removeAgencyPrefix('40_12345')).toBe('12345');
	});

	it('should return original string if no underscore found', () => {
		expect(removeAgencyPrefix('41242')).toBe('41242');
		expect(removeAgencyPrefix('NoPrefix')).toBe('NoPrefix');
	});

	it('should handle null and undefined inputs', () => {
		expect(removeAgencyPrefix(null)).toBe(null);
		expect(removeAgencyPrefix(undefined)).toBe(undefined);
	});

	it('should handle non-string inputs', () => {
		expect(removeAgencyPrefix(123)).toBe(123);
		expect(removeAgencyPrefix({})).toStrictEqual({});
	});

	it('should handle empty strings', () => {
		expect(removeAgencyPrefix('')).toBe('');
	});

	it('should handle strings with multiple underscores', () => {
		expect(removeAgencyPrefix('1_2_3_4')).toBe('2_3_4');
		expect(removeAgencyPrefix('agency_route_stop')).toBe('route_stop');
	});
});

describe('routeShortNamesForStop', () => {
	const stop = { routeIds: ['1_100', '1_200'] };

	it('returns sorted short names for the routes serving the stop', () => {
		const response = {
			data: {
				references: {
					routes: [
						{ id: '1_200', shortName: 'E Line' },
						{ id: '1_100', shortName: '44' },
						{ id: '1_999', shortName: '62' }
					]
				}
			}
		};

		expect(routeShortNamesForStop(response, stop)).toEqual(['44', 'E Line']);
	});

	it('falls back to the route id suffix when shortName is missing', () => {
		const response = {
			data: {
				references: {
					routes: [{ id: '1_100', shortName: null }]
				}
			}
		};

		expect(routeShortNamesForStop(response, stop)).toEqual(['100']);
	});

	it('keeps the full id suffix when the route id contains multiple underscores', () => {
		const response = {
			data: {
				references: {
					routes: [{ id: '1_100_x', shortName: null }]
				}
			}
		};

		expect(routeShortNamesForStop(response, { routeIds: ['1_100_x'] })).toEqual(['100_x']);
	});

	it('returns null when the response has no route references', () => {
		expect(routeShortNamesForStop(null, stop)).toBe(null);
		expect(routeShortNamesForStop({ data: { references: {} } }, stop)).toBe(null);
	});

	it('returns null when the stop has no routeIds array', () => {
		const response = {
			data: { references: { routes: [{ id: '1_100', shortName: '44' }] } }
		};

		expect(routeShortNamesForStop(response, {})).toBe(null);
		expect(routeShortNamesForStop(response, null)).toBe(null);
	});
});
