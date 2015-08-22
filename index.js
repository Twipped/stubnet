
var debug   = require('debug')('stubnet');
var Builder = require('./lib/builder');
var runner  = require('./lib/runner');

module.exports = function () {
	debug('created');

	var stub = new Builder();
	stub.start = function (options) {
		debug('starting', options);
		this.done(options);
		return runner(this.steps);
	}

	return stub;
};
