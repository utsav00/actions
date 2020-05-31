import { setState } from '../utils/pivotalTracker';

export async function updateTicketState(context, inputs): Promise<void> {
	try {
		const targetBranch = context.ref;
		const text = context.payload.pull_request.body;
		const pivotalKey = inputs.pivotalKey;

		console.log('Target branch: ', targetBranch);

		if ((targetBranch === 'staging') && (text !== null)) {

			const regex = /((http|https):\/\/www.pivotaltracker.com\/story\/show\/[1-9]\d{6,})/g;
			const parsedUrls = text.match(regex) || [];

			parsedUrls.forEach((url: string) => {
				const storyId = url.split('/').slice(-1)[0];
				await setState(storyId, pivotalKey);
			});
		}
	} catch(error) {
		console.log('ERROR: ', error);
	}
}