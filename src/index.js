const core = require('@actions/core')
const GitHub = require('./github')
const Vercel = require('./vercel')
const { addSchema } = require('./helpers')

const {
	GITHUB_DEPLOYMENT,
	GITHUB_REPOSITORY,
	USER,
	REPOSITORY,
	SHA,
	CREATE_COMMENT,
	DELETE_EXISTING_COMMENT,
	ALIAS_DOMAINS,
	LOG_URL,
	ACTOR
} = require('./config')

// Following https://perishablepress.com/stop-using-unsafe-characters-in-urls/ only allow characters that won't break the URL.
const urlSafeParameter = (input) => input.replace(/[^a-z0-9_~]/gi, '-')

const run = async () => {
	const github = GitHub.init()
	const octokit = github.client

	const { data: pulls } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
		owner: USER,
		repo: REPOSITORY,
		commit_sha: SHA
	})
	// keep only open PRs, newest first
	const openPulls = pulls.filter((p) => p.state === 'open').toSorted((a, b) => b.number - a.number)

	const pull = openPulls.length ? openPulls[0] : undefined
	const pullNumber = pull ? pull.number : undefined
	const fromFork = pullNumber ? pull.head.repo.full_name !== GITHUB_REPOSITORY : undefined
	const BRANCH = pullNumber ? pull.head.ref : process.env.GITHUB_REF_NAME

	// Refuse to deploy an untrusted fork
	if (fromFork === true) {
		core.warning(`PR is from fork and DEPLOY_PR_FROM_FORK is set to false`)
		const body = `Refusing to deploy this Pull Request to Vercel because it originates from @${ ACTOR }'s fork.`

		const comment = await github.createComment(pullNumber, body)
		core.info(`Comment created: ${ comment.html_url }`)

		core.setOutput('DEPLOYMENT_CREATED', false)
		core.setOutput('COMMENT_CREATED', true)

		core.info('Done')
		return
	}

	if (GITHUB_DEPLOYMENT) {
		core.info('Creating GitHub deployment')
		const ghDeployment = await github.createDeployment()

		core.info(`Deployment #${ ghDeployment.id } created`)

		await github.updateDeployment('pending')
		core.info(`Deployment #${ ghDeployment.id } status changed to "pending"`)
	}

	try {
		core.info(`Creating deployment with Vercel CLI`)
		const vercel = Vercel.init()
		const deploymentUrl = await vercel.deploy()

		core.info('Successfully deployed to Vercel!')

		const deploymentUrls = []

		for (const domain of ALIAS_DOMAINS) {
			// skip non-string or empty domains
			if (typeof domain !== 'string' || !domain.trim()) continue

			core.info(`Assigning alias domains to Vercel deployment: ${ domain }`)
			const alias = domain
				.replace('{USER}', urlSafeParameter(USER))
				.replace('{REPO}', urlSafeParameter(REPOSITORY))
				.replace('{BRANCH}', urlSafeParameter(BRANCH))
				.replace('{SHA}', SHA.substring(0, 7))
				.toLowerCase()
				.trim()

			await vercel.assignAlias(alias)
			deploymentUrls.push(addSchema(alias))
		}

		deploymentUrls.push(addSchema(deploymentUrl))
		const previewUrl = deploymentUrls[0]

		const deployment = await vercel.getDeployment()
		core.info(`Deployment "${ deployment.id }" available at: ${ deploymentUrls.join(', ') }`)

		if (GITHUB_DEPLOYMENT) {
			core.info('Changing GitHub deployment status to "success"')
			await github.updateDeployment('success', previewUrl)
		}

		let commentCreated = false

		if (pullNumber) {
			if (DELETE_EXISTING_COMMENT) {
				core.info('Checking for existing comment on PR')
				const deletedCommentId = await github.deleteExistingComment(pullNumber)
				if (deletedCommentId) core.info(`Deleted existing comment: ${ deletedCommentId }`)
			}

			if (CREATE_COMMENT) {
				core.info('Creating new comment on PR')
				const body = `
					This pull request has been deployed to Vercel.

					<table>
						<tr>
							<td><strong>Latest commit:</strong></td>
							<td><code>${ SHA.substring(0, 7) }</code></td>
						</tr>
						<tr>
							<td><strong>✅ Preview:</strong></td>
							<td><a href='${ previewUrl }'>${ previewUrl }</a></td>
						</tr>
						<tr>
							<td><strong>🔍 Inspect:</strong></td>
							<td><a href='${ deployment.inspectorUrl }'>${ deployment.inspectorUrl }</a></td>
						</tr>
					</table>

					[View Workflow Logs](${ LOG_URL })
				`

				const comment = await github.createComment(pullNumber, body)
				core.info(`Comment created: ${ comment.html_url }`)
				commentCreated = true
			}
		}

		core.setOutput('PREVIEW_URL', previewUrl)
		core.setOutput('DEPLOYMENT_URLS', deploymentUrls)
		core.setOutput('DEPLOYMENT_UNIQUE_URL', deploymentUrls[deploymentUrls.length - 1])
		core.setOutput('DEPLOYMENT_ID', deployment.id)
		core.setOutput('DEPLOYMENT_INSPECTOR_URL', deployment.inspectorUrl)
		core.setOutput('DEPLOYMENT_CREATED', true)
		core.setOutput('COMMENT_CREATED', commentCreated)

		core.info('Done')
	} catch (err) {
		await github.updateDeployment('failure')
		core.setFailed(err.message)
	}
}

run()
	.then(() => {})
	.catch((err) => {
		core.error('ERROR')
		core.setFailed(err.message)
	})