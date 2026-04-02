import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TabLink from '../../components/tabs/TabLink.svelte';

describe('TabLink', () => {
  	it('renders a div with the base tab class', () => {
      		const { container } = render(TabLink, { props: { href: '/home', current: false } });
      		const div = container.querySelector('.tab-container__item');
      		expect(div).toBeTruthy();
    });

         	it('applies the active class when current is true', () => {
            		const { container } = render(TabLink, { props: { href: '/home', current: true } });
            		const div = container.querySelector('.tab-container__item');
            		expect(div).toBeTruthy();
            		expect(div.classList.contains('tab-container__item--active')).toBe(true);
          });

         	it('does not apply the active class when current is false', () => {
            		const { container } = render(TabLink, { props: { href: '/home', current: false } });
            		const div = container.querySelector('.tab-container__item');
            		expect(div).toBeTruthy();
            		expect(div.classList.contains('tab-container__item--active')).toBe(false);
          });

         	it('renders an anchor element with the correct href', () => {
            		const { container } = render(TabLink, { props: { href: '/stops/123', current: false } });
            		const anchor = container.querySelector('a');
            		expect(anchor).toBeTruthy();
            		expect(anchor.getAttribute('href')).toBe('/stops/123');
          });
});
