const core = require('@actions/core')
const github = require('@actions/github')
const parser = require('action-input-parser')

const context = {
	GITHUB_TOKEN: parser.getInput({
		key: [ 'GH_PAT', 'GITHUB_TOKEN' ],
		required: true
	}),
	VERCEL_TOKEN: parser.getInput({
		key: 'VERCEL_TOKEN',
		required: true
	}),
	VERCEL_ORG_ID: parser.getInput({
		key: 'VERCEL_ORG_ID',
		required: true
	}),
	VERCEL_PROJECT_ID: parser.getInput({
		key: 'VERCEL_PROJECT_ID',
		required: true
	}),
	PRODUCTION: parser.getInput({
		key: 'PRODUCTION',
		type: 'boolean',
		default: true
	}),
	GITHUB_DEPLOYMENT: parser.getInput({
		key: 'GITHUB_DEPLOYMENT',
		type: 'boolean',
		default: true
	}),
	CREATE_COMMENT: parser.getInput({
		key: 'CREATE_COMMENT',
		type: 'boolean',
		default: true
	}),
	DELETE_EXISTING_COMMENT: parser.getInput({
		key: 'DELETE_EXISTING_COMMENT',
		type: 'boolean',
		default: true
	}),
	ATTACH_COMMIT_METADATA: parser.getInput({
		key: 'ATTACH_COMMIT_METADATA',
		type: 'boolean',
		default: true
	}),
	DEPLOY_PR_FROM_FORK: parser.getInput({
		key: 'DEPLOY_PR_FROM_FORK',
		type: 'boolean',
		default: false
	}),
	PR_LABELS: parser.getInput({
		key: 'PR_LABELS',
		default: [ 'deployed' ],
		type: 'array',
		disableable: true
	}),
	ALIAS_DOMAINS: parser.getInput({
		key: 'ALIAS_DOMAINS',
		default: [],
		type: 'array',
		disableable: true
	}),
	PR_PREVIEW_DOMAIN: parser.getInput({
		key: 'PR_PREVIEW_DOMAIN'
	}),
	VERCEL_SCOPE: parser.getInput({
		key: 'VERCEL_SCOPE'
	}),
	GITHUB_REPOSITORY: parser.getInput({
		key: 'GITHUB_REPOSITORY',
		required: true
	}),
	GITHUB_DEPLOYMENT_ENV: parser.getInput({
		key: 'GITHUB_DEPLOYMENT_ENV'
	}),
	TRIM_COMMIT_MESSAGE: parser.getInput({
		key: 'TRIM_COMMIT_MESSAGE',
		type: 'boolean',
		default: false
	}),
	WORKING_DIRECTORY: parser.getInput({
		key: 'WORKING_DIRECTORY'
	}),
	BUILD_ENV: parser.getInput({
		key: 'BUILD_ENV',
		type: 'array'
	}),
	PREBUILT: parser.getInput({
		key: 'PREBUILT',
		type: 'boolean',
		default: false
	})
}

const setDynamicVars = () => {
	context.USER = context.GITHUB_REPOSITORY.split('/')[0]
	context.REPOSITORY = context.GITHUB_REPOSITORY.split('/')[1]

	context.LOG_URL = `https://github.com/${ context.USER }/${ context.REPOSITORY }/actions/runs/${ process.env.GITHUB_RUN_ID }`

	context.ACTOR = github.context.actor
	context.REF = github.context.ref
	context.SHA = github.context.sha
}

setDynamicVars()

core.setSecret(context.GITHUB_TOKEN)
core.setSecret(context.VERCEL_TOKEN)

core.debug(
	JSON.stringify(
		context,
		null,
		2
	)
)

module.exports = context