const {URL} = require('url');
const Git = require('nodegit');
const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);

class GitExtended {
	/**
	 * Init the Git class
	 * @param {VersioningInfo} git
	 * @returns {Git} A Git Repository object
	 */
	constructor(options) {
		this.opts = options;
		return this;
	}

	get remoteUrl() {
		return this.remote.url().slice(0, this.remote.url().indexOf('.git')) + '/';
	}

	/**
	 * Clone the repo and set head and stuff
	 * @param {String} path
	 */
	async init(path) {
		this.path = path;
		this.repo = await this._cloneRepo();
		this.remote = await Git.Remote.lookup(this.repo, this.opts.remote);
		return this;
	}

	/**
	 * Clones repository according to the given Git options to the specified path
	 * @returns {Repository} A Git Repository object
	 */
	async _cloneRepo() {
		return Git.Clone(this.opts.remoteUrl || this.opts.url, this.path, {
			checkoutBranch: this.opts.branch,
			fetchOpts: {
				callbacks: {
					credentials: (url, userName) => {
						if (this.opts.token && this.opts.token !== '') {
							return Git.Cred.userpassPlaintextNew(this.opts.token, 'x-oauth-basic');
						}
						return Git.Cred.sshKeyFromAgent(userName);
					},
					certificateCheck() {
						return 1;
					},
				},
			},
		});
	}

	/**
	 * @typedef {Object} CommitDetails
	 * @property {Commit} commit Git object
	 * @property {string} hash	SHA1 hash for commit
	 * @property {string} short	A short hash of commit (length: 7)
	 * @property {string} url Github url to commit
	 * @property {string} message Commit message
	 * @property {string} author Commit author name
	 * @property {string} report Url to the report for this commit (might not be valid)
	 */

	/**
	 * Get Commit details
	 * @param {String} commit A Commit hash string
	 * @returns {CommitDetails}
	 */
	async getCommit(commit) {
		if (typeof commit === 'string' || commit instanceof String) {
			commit = await Git.Commit.lookup(this.repo, commit);
		}
		return {
			commit,
			hash: commit.toString(),
			short: commit.toString().substr(0, 7),
			url: new URL(`commit/${commit.toString()}`, this.remoteUrl).href,
			message: commit.message().trim(),
			author: commit.author().toString().slice(0, commit.author().toString().indexOf('<')).trim(),
		};
	}

	/**
	 * Get HEAD details
	 * @returns {CommitDetails} CommitDetails object of HEAD commit
	 */
	async getHead() {
		if (this.head) return this.head;
		const head = await this.repo.getHeadCommit();
		this.head = await this.getCommit(head);
		return this.head;
	}

	/**
	 * Checkout to commit
	 * @param {CommitDetails|String} commit A CommitDetails object or a commit hash string
	 */
	async checkout(commit) {
		if (typeof commit === 'string' || commit instanceof String) {
			commit = await this.getCommit(commit);
		}
		else if (typeof commit === 'object' && commit.commit.toString() !== commit.hash) {
			commit.commit = await Git.Commit.lookup(this.repo, commit.hash);
		}

		await Git.Checkout.tree(this.repo, commit.commit, {
			checkoutStrategy: Git.Checkout.STRATEGY.FORCE,
		});
		await this.repo.setHeadDetached(commit.commit.id());
		this.head = commit;
	}

	async bisect(pass) {
		if (pass === undefined) throw new Error('Bisect good or bad not defined');
		const io = await exec('git bisect ' + (pass ? 'good' : 'bad'), {
			cwd: this.path,
		});
		const head = await this.repo.getHeadCommit();
		this.head = await this.getCommit(head);
		return io;
	}

	async bisectStart() {
		return exec('git bisect start', {cwd: this.path});
	}
}

module.exports = GitExtended;