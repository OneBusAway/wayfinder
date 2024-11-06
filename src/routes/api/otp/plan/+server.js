import { error, json } from '@sveltejs/kit';

export async function GET() {
    try {
        const response = await fetch(
            'https://otp.prod.sound.obaweb.org/otp/routers/default/plan?fromPlace=47.5423055%2C-122.38677&toPlace=47.639376%2C-122.128238',
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw error(response.status, `OpenTripPlanner API returned status ${response.status}`);
        }

        const data = await response.json();
        return json(data);

    } catch (err) {
        // If it's already a SvelteKit error, rethrow it
        if (err.status) throw err;

        // Otherwise wrap it in a 500 error
        throw error(500, {
            message: 'Failed to fetch trip planning data',
            error: err.message
        });
    }
}