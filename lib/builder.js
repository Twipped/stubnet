'use strict';

var assert = require('assert');
var extend = require('util')._extend;
var debug = require('debug')('stubnet:builder');
var noop = function(){};

function Step(type, options) {
	this.type = type;
	this.timer = null;

	var doneFlag = false;
	this.done = function () {
		if (doneFlag) return;
		doneFlag = true;
		(typeof options.done === 'function' && options.done || noop).apply(this, arguments);
	};

	this.pass = function () {
		(typeof options.pass === 'function' && options.pass || noop).call(this, this.name || 'StubNet ' + this.type);
		this.done.call(this);
	};

	this.fail = function () {
		if (this.timer) clearTimeout(this.timer);
		(typeof options.fail === 'function' && options.fail || noop).apply(this, arguments);
		this.done.apply(this, arguments);
	};
	this.name = options.name || '';
}

Step.prototype.is = function (type) {
	return this.type === type;
};

function stepOptions (options) {
	if (typeof options === 'function') {
		return {done: options};
	}

	if (typeof options !== 'object') {
		return {};
	}

	return options;
}

function Builder() {
	this.steps = [];
}

Builder.prototype = extend(Builder.prototype, {

	assertFirstStep: function assertFirstStep () {
		do {
			if (!this.steps.length) break;
			if (this.steps[0].type === 'listen') return;
		} while (false);

		assert(false, 'You must define a listen step first.');
	},

	assertLastStep: function assertLastStep () {
		do {
			if (!this.steps.length) return;

			var lastStep = this.steps[this.steps.length - 1];

			if (lastStep.type === 'done') break;

			return;
		} while (false);

		assert(false, 'You cannot add more steps after the stack is closed.');
	},

	listenTo: function listenTo (options) {
		debug('pushing', 'listen', options);
		options = stepOptions(options);

		this.assertLastStep();
		assert(options.arguments && typeof options.arguments[0] === 'number' || options.port, 'You must provide a port to listen on');

		var step = new Step('listen', options);
		step.arguments = options.arguments || null;
		step.bind      = options.bind || '0.0.0.0';
		step.port      = options.port;
		step.secure    = options.secure;
		this.steps.push(step);

		return this;
	},

	expectConnection: function expectConnection (options) {
		debug('pushing', 'connection', options);
		options = stepOptions(options);

		this.assertFirstStep();
		this.assertLastStep();

		var step = new Step('connection', options);
		step.timeout = options.timeout;
		this.steps.push(step);

		return this;
	},

	expectDataFrom: function expectDataFrom (index, data, options) {
		debug('pushing', 'receive', index, data, options);
		options = stepOptions(options);

		this.assertFirstStep();
		this.assertLastStep();

		if (typeof data === 'string') {
			data = new Buffer(data);
		}

		var step = new Step('receive', options);
		step.socketIndex = index;
		step.timeout = options.timeout;
		step.data = data;

		this.steps.push(step);

		return this;
	},

	expectData: function expectData (data, options) {
		return this.expectDataFrom(0, data, options);
	},

	expectNoDataFrom: function expectNoDataFrom (index, options) {
		debug('pushing', 'buffer is empty', index, options);
		options = stepOptions(options);

		this.assertFirstStep();
		this.assertLastStep();

		var step = new Step('buffer is empty', options);
		step.timeout = options.timeout;
		step.socketIndex = index;

		this.steps.push(step);

		return this;
	},

	expectNoData: function expectNoData (options) {
		return this.expectNoDataFrom(0, options);
	},

	expectDisconnectBy: function expectDisconnectBy (index, options) {
		debug('pushing', 'ended', index, options);
		options = stepOptions(options);

		this.assertFirstStep();
		this.assertLastStep();

		var step = new Step('ended', options);
		step.timeout = options.timeout;
		step.socketIndex = index;

		this.steps.push(step);

		return this;
	},

	expectDisconnect: function expectDisconnect (options) {
		return this.expectDisconnectBy(0, options);
	},

	thenSendTo: function thenSendTo (index, data, options) {
		debug('pushing', 'send', index, data);
		options = stepOptions(options);

		this.assertFirstStep();
		this.assertLastStep();

		if (typeof data === 'string') {
			data = new Buffer(data);
		}

		var step = new Step('send', options);
		step.socketIndex = index;
		step.data = data;

		this.steps.push(step);

		return this;
	},

	thenSend: function thenSend (data, options) {
		return this.thenSendTo(0, data, options);
	},

	thenClose: function thenClose (index, options) {
		debug('pushing', 'closed', index, options);
		if (typeof index === 'object' || typeof index === 'function') {
			options = stepOptions(index);
			index = 0;
		} else if (typeof index === 'undefined') {
			index = 0;
			options = {};
		} else {
			options = stepOptions(options);
		}

		this.assertFirstStep();
		this.assertLastStep();

		var step = new Step('closed', options);
		step.socketIndex = index;

		this.steps.push(step);

		return this;
	},

	done: function done (options) {
		debug('pushing', 'done', options);
		options = stepOptions(options);

		var step = new Step('done', options);
		this.steps.push(step);

		return this;
	}
});

module.exports = Builder;
