const core = require('@actions/core');
const github = require('@actions/github');

import { addLabels, removeLabel } from '../utils/labeler';
import { parseReviews } from '../utils/parseReviews';
import { getReviews } from '../utils/getReviews';
import { Octokit } from '@octokit/core';

const getBranchCommits = async (
	url,
	targetBranch,
	octokit
): Promise<Array<object>> => {
	const branchCommitsResponse = await octokit.request(
		`GET ${url}?sha=${targetBranch}`
	);
	console.log(
		`${targetBranch} commits: `,
		JSON.stringify(branchCommitsResponse.data),
		'\n'
	);
	return branchCommitsResponse.data;
};

const getCommitsForPR = async (url, octokit): Promise<Array<object>> => {
	const prCommitsResponse = await octokit.request(`GET ${url}`);
	console.log('PR commits: ', JSON.stringify(prCommitsResponse.data), '\n');
	return prCommitsResponse.data;
};

const shouldShowBranchLabel = (prCommits, branchCommits): boolean => {
	return prCommits.some((prCommit) =>
		branchCommits.some(
			(branchCommit) =>
				branchCommit.sha === prCommit.sha ||
				(branchCommit.parents.length > 1 &&
					branchCommit.parents
						.map((parent) => parent.sha)
						.includes(prCommit.sha))
		)
	);
};

async function main(): Promise<void> {
	// Get a few inputs from the GitHub event.
	const inputs: {
		token: string;
		requiredReviews: number;
		labelWIP: boolean;
		branch: string;
	} = {
		token           : core.getInput('repo-token', { required: true }),
		requiredReviews : core.getInput('required'),
		labelWIP        : core.getInput('wip'),
		branch          : core.getInput('target-branch', { required: true }),
	};

	const pr = github.context.payload.pull_request;
	if (!pr) {
		core.setFailed(
			'This action must be run with only "pull_request" or "pull_request_review".'
		);
		return;
	}
	const pullNumber = pr.number;
	const draftPR = pr.draft;

	console.log('PR number is', pullNumber);
	console.log('Inputs', inputs);

	if (inputs.requiredReviews && !(inputs.requiredReviews > 0)) {
		core.setFailed('If set, "required" must be an integer greater than 0');
		return;
	}

	const client = new github.GitHub(inputs.token);
	const { data } = await getReviews(inputs.token, pullNumber);

	if (inputs.requiredReviews > 0) {
		const activeReviews = parseReviews(data || []);
		const approvedReviews = activeReviews.filter(
			(r) => r.state.toLowerCase() === 'approved'
		);

		console.log('active', activeReviews);

		let reviewCount = approvedReviews.length;
		if (reviewCount > inputs.requiredReviews) {
			reviewCount = inputs.requiredReviews;
		}

		const toAdd = `${reviewCount} of ${inputs.requiredReviews}`;

		// Loop through the current labels and remove any existing "x of y" labels
		for (let i = 0; i <= inputs.requiredReviews; i++) {
			// When removing, we need to escape special characters
			const loopCount = `${i}%20of%20${inputs.requiredReviews}`;

			// Don't remove the one we're trying to add, just in case a race condition happens on the server
			if (i !== reviewCount) {
				removeLabel(client, pullNumber, loopCount);
			}
		}

		addLabels(client, pullNumber, [toAdd]);
	}

	if (inputs.labelWIP && draftPR) {
		addLabels(client, pullNumber, ['WIP']);
	} else if (inputs.labelWIP && !draftPR) {
		removeLabel(client, pullNumber, 'WIP');
	}

	const octokit = new Octokit({ auth: inputs.token });
	const prCommits = await getCommitsForPR(pr.commits_url, octokit);

	const commitsUrl = pr.base.repo.commits_url.split('{/')[0];
	const branchCommits = await getBranchCommits(
		commitsUrl,
		inputs.branch,
		octokit
	);

	const prLabels = pr.labels.map((label) => label.name);

	const showBranchLabel = shouldShowBranchLabel(prCommits, branchCommits);

	const label = `Changes in ${inputs.branch}`;

	if (!showBranchLabel && prLabels.includes(label)) {
		removeLabel(client, pullNumber, label);
	}

	if (showBranchLabel) {
		addLabels(client, pullNumber, [label]);
	}
}

// Call the main function.
main();
