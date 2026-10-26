import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi } from 'vitest';
import SurveyQuestion from '../SurveyQuestion.svelte';

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return { unsubscribe: () => {} };
		})
	}
}));

const radioQuestion = {
	id: 1,
	required: true,
	content: {
		type: 'radio',
		label_text: 'How easy was it to use the app?',
		options: ['Very Easy', 'Neutral']
	}
};

describe('SurveyQuestion', () => {
	test('does not show the required message when the parent says there is no error', async () => {
		const user = userEvent.setup();

		render(SurveyQuestion, {
			props: {
				question: radioQuestion,
				required: true,
				value: '',
				onInputChange: vi.fn(),
				error: false
			}
		});

		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();

		await user.click(screen.getByLabelText('Very Easy'));

		// The component must not decide on its own that this is an error.
		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();
	});

	test('shows the required message when the parent says there is an error', () => {
		render(SurveyQuestion, {
			props: {
				question: radioQuestion,
				required: true,
				value: '',
				onInputChange: vi.fn(),
				error: true
			}
		});

		expect(screen.getByText('survey.required_answer')).toBeInTheDocument();
	});

	test('reports the selected option to onInputChange', async () => {
		const user = userEvent.setup();
		const onInputChange = vi.fn();

		render(SurveyQuestion, {
			props: {
				question: radioQuestion,
				required: true,
				value: '',
				onInputChange,
				error: false
			}
		});

		await user.click(screen.getByLabelText('Very Easy'));

		expect(onInputChange).toHaveBeenCalledWith('Very Easy');
	});

	test('reports every selected checkbox option to onInputChange', async () => {
		const user = userEvent.setup();
		const onInputChange = vi.fn();

		render(SurveyQuestion, {
			props: {
				question: {
					id: 2,
					content: {
						type: 'checkbox',
						label_text: 'Which did you ride?',
						options: ['Bus', 'Ferry']
					}
				},
				value: ['Bus'],
				onInputChange,
				error: false
			}
		});

		await user.click(screen.getByLabelText('Ferry'));
		expect(onInputChange).toHaveBeenLastCalledWith(['Bus', 'Ferry']);

		await user.click(screen.getByLabelText('Bus'));
		expect(onInputChange).toHaveBeenLastCalledWith([]);
	});
});
