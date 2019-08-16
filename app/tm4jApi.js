const fetch = require("node-fetch");
const HttpUtils = require("./httpUtils.js");
const fs = require('fs');
const FormData = require('form-data');

class TM4JApi {
	constructor(jiraSettings) {
		this.jiraSettings = jiraSettings;
		this.currentTestCaseIndex = 0;
		this.currentPage = 0;
		this.firstPageLoaded = false;
		this.pageSize = 200;
	}

	getIssueKey(testCase) {
		if(!testCase.customFields) {
			return;
		}
		return testCase.customFields[this.jiraSettings.issueKeyCustomField];
	}

	async validate() {
		const response = await fetch(this._getTestUrl(),
			HttpUtils.getAuthHeader(this.jiraSettings.user, this.jiraSettings.password));
		const isValid = response.status == 200;
		if(!isValid) {
			console.log(await response.text());
		}
		return isValid;
	}

	async getNextTestCase() {
		if(!this.testCases) {
			await this._loadNextTestCasePage();
		}

		if(this.currentTestCaseIndex >= this.testCases.length) {
			let isEof = await this._loadNextTestCasePage();
			if(isEof) {
				return;
			}
			this.currentTestCaseIndex = 0;
		}

		const testCase = this.testCases[this.currentTestCaseIndex];
		this.currentTestCaseIndex++;		
		return testCase;
	}

	async uploadAttachments(issueKey, testCaseKey) {
		const imagesDir = `./images/${issueKey}`;
		const files = fs.readdirSync(imagesDir);
		for(let file of files) {
	    	await this._uploadAttachmentToTestCase(testCaseKey, `${imagesDir}/${file}`);
		}
	}

	async _uploadAttachmentToTestCase(testCaseKey, filePath) {
		const formData = new FormData();
		formData.append('file', fs.createReadStream(filePath));

		const reqHeadersObj = {
			method: 'POST',
			body: formData,
			headers: formData.getHeaders()
		}

		const authHeader = HttpUtils.getAuthHeader(this.jiraSettings.user, this.jiraSettings.password);
		reqHeadersObj.headers.Authorization = authHeader.headers.Authorization;

		const response = await fetch(`${this.jiraSettings.url}/rest/atm/1.0/testcase/${testCaseKey}/attachments`, reqHeadersObj);
		const isValid = response.status == 201;
		if(!isValid) {
			console.log(await response.text());
			throw `Error uploading attachment ${filePath} to test case ${testCaseKey}`;
		}
	}

	async _loadNextTestCasePage() {
		if(this.testCases) {
			this.currentPage++;
		}
		if(this.testCases && (this.testCases.length < this.pageSize)) return true;
		await this._loadPage(this.currentPage);
		return this.testCases.length === 0;
	}

	async _loadPage(pageNumber) {
		const response = await fetch(this._getTestCaseSearchUrl(pageNumber),
			HttpUtils.getAuthHeader(this.jiraSettings.user, this.jiraSettings.password));
		const isValid = response.status == 200;
		if(!isValid) {
			console.log(await response.text());
			throw 'Error retrieving test cases';
		}
		this.testCases = await response.json();
	}

	_getTestUrl() {
		return encodeURI(`${this.jiraSettings.url}/rest/atm/1.0/testcase/search?query=status = Deprecated&fields=id,key`);
	}

	_getTestCaseSearchUrl(page) {
		return encodeURI(`${this.jiraSettings.url}/rest/atm/1.0/testcase/search?query=projectKey = \"${this.jiraSettings.projectKey}\"&fields=key,customFields&startAt=${this.pageSize * this.currentPage}&maxResults=${this.pageSize}`);
	}
}

module.exports = TM4JApi;