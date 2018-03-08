const util = require('util');
const rfs = require('rotating-file-stream');

let logStream;

function initLogStream(logDir = '/smartprix/logs/server_logs/pm2') {
	if (!logStream) {
		logStream = rfs('pm2-githook2.log', {
			interval: '1d',
			maxFiles: 10,
			path: logDir,
		});
	}
	return logStream;
}


function pad(str) {
	str = str.toString();
	if (str.length >= 2) return str.substr(0, 2);
	str = '0' + str;
	return str;
}

function timezoneOffset(offset) {
	const sign = offset < 0 ? '+' : '-';
	offset = Math.abs(offset);
	const hours = Math.floor(offset / 60);
	const mins = offset - (60 * hours);
	return `${sign}${pad(hours)}:${pad(mins)}`;
}

/**
 * Get local time in ISO format
 * @returns Current time in local timezone in format : `[DD-MM-YYYY HH:mm:ss:SS Z] `
 */
function timePrefix() {
	const d = new Date();
	return `[${pad(d.getDate())}-${pad(d.getMonth())}-${d.getFullYear()} ` +
		`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(d.getMilliseconds())} ` +
		`${timezoneOffset(d.getTimezoneOffset())}] `;
}

module.exports = {
	log(...args) {
		const txt = timePrefix() + util.format(...args);
		console.log(txt);
		logStream.write(txt);
	},

	error(...args) {
		const txt = timePrefix() + util.format(...args);
		console.error(txt);
		logStream.write(txt);
	},

	write(...args) {
		logStream.write(timePrefix() + util.format(...args));
	},

	init: initLogStream,
};