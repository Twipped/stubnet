var net = require('net');
var tls = require('tls');
var nodeAssert = require('assert');
var extend = require('util')._extend;
var debug = require('debug')('stubnet');
var bufferCompare = require('buf-compare');

module.exports = function (config) {

	debug('created');
	config = extend({
		assert: nodeAssert
	}, config || {});

	var assert = {
		ok: config.assert.ok || (typeof config.assert.assert === 'function' && config.assert.assert) || nodeAssert,
		equal: config.assert.equal || (typeof config.assert.equal === 'function' && config.assert.equal) || nodeAssert.equal,
	};

	var steps = [];
	var server;
	var sockets = [];
	var buffers = [];

	function nextStepForSocket(index) {
		function next (i) {
			if (i > steps.length) {return;}
			if (steps[i].socketIndex === index) {
				return steps[i];
			}
			return next(i + 1);
		}
		return next(0);
	}

	function fail() {
		mock.stop();
		var lastStep = steps.length && steps[steps.length - 1]
		if (lastStep) {
			stepChecks[lastStep.action](lastStep);
		}
	}

	function process () {
		var currentStep = steps[0];
		if (!currentStep) {
			debug('process', null);
			try {
				assert.ok(false, 'Stubnet events occurred after test completion.');
			} finally {
				fail();
			}
			return;
		}
		debug('process', currentStep.action, currentStep.message);

		return stepChecks[currentStep.action](currentStep);
	}

	function processData(index) {
		debug('processData', steps[0] && steps[0].action);
		if (!steps[0]) {
			assert.ok(false, "Received data after all steps completed");
		}

		if (steps[0].action === 'receive' && steps[0].socketIndex === index && buffers[index]) {
			var segment;
			var expecting = steps[0].data;
			
			if (buffers[index].length < expecting.length) {
				// perform a shallow compare so we can reject early.
				segment = expecting.slice(0, buffers[index].length);
				if (bufferCompare(buffers[index],segment)) {
					debug('asserting', 'that the partial buffer does not match');
					try {
						assert.equal(buffers[index].toString(), segment.toString(), steps[0].message || 'Expected data did not match');
					} finally {
						fail();
					}
				}

				return;
			}

			segment = buffers[index].slice(0, expecting.length)
			if (bufferCompare(expecting, segment)) {
				debug('asserting', 'that buffer contents do not match');
				try {
					assert.equal(expecting.toString(), segment.toString(), steps[0].message || 'Expected data did not match');
				} finally {
					fail();
				}
			} else {
				debug('asserting', 'that buffer contents do match');
				assert.ok(true, steps[0].message || 'Expecting received data');

				buffers[index] = buffers[index].slice(expecting.length);
				steps.shift();
				return process();
			}
		}
	}

	var stepChecks = {
		'listen': function (currentStep) {
			debug('stepCheck', 'listen');
			if (currentStep.serverConfig && currentStep.serverConfig.secure) {
				server = tls.createServer(currentStep.serverConfig.secure);
			} else {
				server = net.createServer();
			}

			server.on('error', function (err) {
				debug('server error', err);
				throw err;
			});

			server.on('connection', function (socket) {
				debug('connection', sockets.length);
				if (steps[0].action === 'connection') {
					debug('asserting', 'connection opened ok');
					assert.ok(true, steps[0].message || "Connection received");
					clearTimeout(steps[0].timer)
					steps.shift();
				} else {
					debug('asserting', 'that an unexpected connection occured');
					assert.ok(false, "Unexpected connection received" + (steps[0].message ? ' (' + steps[0].message + ')' : ''));
				}

				var index = sockets.length;
				sockets.push(socket);

				socket.on('data', function (data) {
					debug('data', index, data);
					if (!buffers[index]) {
						buffers[index] = new Buffer(data);
					} else {
						buffers[index] = Buffer.concat(buffers[index], data);
					}

					return processData(index);
				});

				socket.on('end', function () {
					debug('end', index);
					if (steps[0].action === 'end' && steps[0].socketIndex === index) {
						debug('asserting', 'connection ended ok')
						assert.ok(true, steps[0].message || 'Socket ended');
						clearTimeout(steps[0].timer);
						steps.shift();
					} else {
						debug('asserting', 'that the socket closed too early');
						assert.ok(false, "Socket " + index + " closed early" + (steps[0].message ? ' (' + steps[0].message + ')' : ''));
					}

					sockets[index] = null;
					buffers[index] = null;

					return process();
				});

				socket.on('close', function () {
					debug('close', index);
					if (steps[0] && [0].action === 'close' && steps[0].socketIndex === index) {
						debug('asserting', 'connection closed ok')
						assert.ok(true, steps[0].message || 'Socket closed');
						clearTimeout(steps[0].timer);
						steps.shift();
					}

					sockets[index] = null;
					buffers[index] = null;

					return process();
				});

				return process();
			});

			server.on('listening', function () {
				debug('asserting', 'listening for connections');
				assert.ok(true, currentStep.message || 'Listening for connections');
				steps.shift();
				if (typeof currentStep.callback === 'function') {
					debug('invoking listening callback')
					currentStep.callback();
				}
				process();
			});

			server.listen.apply(server, currentStep.arguments);
		},

		'connection': function (currentStep) {
			debug('stepCheck', 'connection');
			currentStep.timer = setTimeout(function () {
				debug('asserting', 'a timeout waiting for connection')
				try {
					assert.ok(false, "Timed out waiting for a socket to connect" + (currentStep.message ? ' (' + currentStep.message + ')' : ''));
				} finally {
					fail();
				}
			}, currentStep.timeout || 30000);
		},

		'receive': function (currentStep) {
			debug('stepCheck', 'receive');
			processData(currentStep.socketIndex)
		},

		'send': function (currentStep) {
			debug('stepCheck', 'send');
			if (!sockets[currentStep.socketIndex]) {
				debug('sent step occurring out of order')
				assert.ok(false, 'A sent step was configured to occur before a connection existed' + (currentStep.message ? ' (' + currentStep.message + ')' : ''));
				return;
			}

			sockets[currentStep.socketIndex].write(currentStep.data, function () {
				debug('asserting', 'that data sent')
				assert.ok(true, currentStep.message || 'Sent data');
				process();
			});
			steps.shift();
		},

		'end': function (currentStep) {
			debug('stepCheck', 'end');
			//wait for end event
			currentStep.timer = setTimeout(function () {
				debug('asserting', 'a timeout waiting for a socket to end');
				try {
					assert.ok(false, "Timed out waiting for socket " + currentStep.socketIndex + " to end" + (currentStep.message ? ' (' + currentStep.message + ')' : ''));
				} finally {
					fail();
				}
			}, currentStep.timeout || 30000);
		},

		'close': function (currentStep) {
			debug('stepCheck', 'close');
			// wait for close event
			currentStep.timer = setTimeout(function () {
				debug('asserting', 'a timeout waiting for a socket to close');
				try {
					assert.ok(false, "Timed out waiting for socket " + currentStep.socketIndex + " to close" + (currentStep.message ? ' (' + currentStep.message + ')' : ''));
				} finally {
					fail();
				}
			}, currentStep.timeout || 30000);
		},

		'buffer is empty': function (currentStep) {
			debug('stepCheck', 'buffer is empty');
			debug('asserting', 'if a connection buffer is empty');
			if (buffers[currentStep.socketIndex] && buffers[currentStep.socketIndex].length) {
				try {
					assert.equal(buffers[currentStep.socketIndex].toString(), '', currentStep.message || 'Expected buffer to be empty');
				} finally {
					fail();
				}
			} else {
				assert.ok(true, currentStep.message || 'Buffer is empty');
				steps.shift();
				return process();
			}
		},

		'done': function (currentStep) {
			debug('stepCheck', 'done');
			if (server) {
				server.close(function () {
					debug('server closed');
					if (typeof currentStep.callback === 'function') {
						currentStep.callback();
					}
				});
				server = null;
			} else if (typeof currentStep.callback === 'function') {
				currentStep.callback();
			}
			steps.shift();
		}
	};

	var mock = {
		buffer: null,

		listenTo: function listenTo (options) {
			options = options || {};

			debug('pushing', 'listen', options);
			steps.push({
				action: 'listen',
				message: options.message,
				arguments: options.args || [options.port, '0.0.0.0'],
				callback: options.ready
			});
			return mock;
		},

		expectConnection: function (message) {
			debug('pushing', 'connection');
			steps.push({
				action: 'connection',
				message: message
			});
			return mock;
		},

		expectDataFrom: function expectDataFrom (index, data, message) {
			debug('pushing', 'receive', index, data);
			if (typeof data === 'string') {
				data = new Buffer(data);
			}
			steps.push({
				action: 'receive',
				data: data,
				socketIndex: index,
				message: message
			});
			return mock;
		},

		expectData: function expectData (data, message) {
			return mock.expectDataFrom(0, data, message);
		},

		expectNoDataFrom: function (index, message) {
			debug('pushing', 'buffer is empty', index, data);
			steps.push({
				action: 'buffer is empty',
				message: message
			});

			return mock;
		},

		expectNoData: function (message) {
			return mock.expectNoDataFrom(0, message);
		},

		expectDisconnectBy: function expectDisconnectBy (index, message) {
			debug('pushing', 'disconnect', index);
			steps.push({
				action: 'end',
				socketIndex: index,
				message: message
			});
			return mock;
		},

		expectDisconnect: function expectDisconnect (message) {
			return mock.expectDisconnectBy(0, message);
		},

		thenSendTo: function thenSendTo (index, data, message) {
			debug('pushing', 'send', index, data);
			if (typeof data === 'string') {
				data = new Buffer();
			}
			steps.push({
				action: 'send',
				data: data,
				socketIndex: index,
				message: message
			});
			return mock;
		},

		thenSend: function thenSend (data, message) {
			return mock.thenSendTo(0, data, message);
		},

		thenClose: function thenClose (index, message) {
			debug('pushing', 'close', index);
			if (typeof index === 'string') {
				message = index;
				index = 0;
			} else if (typeof index === 'undefined') {
				index = 0;
			}

			steps.push({
				action: 'close',
				socketIndex: index,
				message: message
			});
			return mock;
		},

		start: function start (callback) {
			debug('pushing', 'done');
			if (server) {throw new Error('A server is already running.');}

			steps.push({
				action: 'done',
				callback: callback
			});

			process();

			return mock;
		},

		stop: function stop (cb) {
			if (server) {
				server.close(cb);
				server = null;
			}
			return mock;
		},

		_debug: {
			_getSteps: function () {
				return steps;
			},

			_setSteps: function (s) {
				steps = s;
			},

			_process: process
		}

	};

	return mock;

};
