import { render, screen } from '@testing-library/svelte';
import { expect, test, describe } from 'vitest';
import TabContainer from '../components/tabs/TabContainer.svelte';
import TabContainerFixture from './fixtures/TabContainerFixture.svelte';

describe('TabContainer', () => {
	test('renders the tab-container div', () => {
		const { container } = render(TabContainer);
		const div = container.firstElementChild;

		expect(div).toBeInTheDocument();
		expect(div).toHaveClass('tab-container');
	});

	test('renders children snippets correctly', () => {
		render(TabContainerFixture, { text: 'Custom Tab Content' });

		const child = screen.getByTestId('tab-child');
		expect(child).toBeInTheDocument();
		expect(child).toHaveTextContent('Custom Tab Content');

		// Ensure it's rendered inside the tab-container
		expect(child.parentElement).toHaveClass('tab-container');
	});
});
