'use strict';

var net = require('net');
var tls = require('tls');
var debug = require('debug')('stubnet:runner');
var assert = require('assert');
var AssertionError = assert.AssertionError;
var bufferCompare = require('buf-compare');
var DEFAULT_TIMEOUT = 10000;

module.exports = function runner (baseSteps) {
	if (!baseSteps || !baseSteps.length) {
		throw new Error('You must define steps for the server to perform.');
	}

	// make sure we're working with a duplicate
	var steps = baseSteps.concat();

	var server;
	var sockets = [];
	var buffers = [];

	function shutdown (callback) {
		var pending = 0;

		function finished() {
			pending--;
			if (pending > 0) return;

			sockets = [];
			buffers = [];
			steps   = [];

			callback();
		}

		pending += sockets.length;
		if (server) {
			pending++;
		}

		sockets.forEach(function (socket, index) {
			if (!socket) return finished();
			debug('closing socket', index);
			sockets[index] = null;
			socket.end(function () {
				debug('socket closed', index);
				finished();
			});
		});

		if (server) {
			server.close(function () {
				debug('server closed');
				finished();
			});
			server = null;
		}
	}

	function firstStep() {
		return steps[0];
	}

	function lastStep() {
		return steps.length && steps[steps.length - 1];
	}

	function failed(assertion) {
		if (steps.length > 1) {
			firstStep().fail(assertion);
		}

		var doneStep = lastStep();
		shutdown(function () {
			debug('failure back from shutdown', steps.length);
			doneStep.fail(assertion);
		});
	}

	function process () {
		var currentStep = firstStep();
		if (!currentStep) {
			debug('process', null);

			try {
				assert(false, 'Stubnet events occurred after test completion.');
			} finally {
				failed();
			}
			return;
		}
		debug('process', currentStep.type);

		return stepChecks[currentStep.type](currentStep);
	}

	function processData(index) {
		var currentStep = firstStep();
		debug('processData', currentStep && currentStep.type);

		if (!sockets[index]) {
			// test is done, we don't care any more.
			clearTimeout(currentStep.timer);
			return;
		}

		if (currentStep.is('receive') && currentStep.socketIndex === index && buffers[index]) {
			var segment;
			var expecting = currentStep.data;

			if (buffers[index].length < expecting.length) {
				// perform a shallow compare so we can reject early.
				segment = expecting.slice(0, buffers[index].length);
				if (bufferCompare(buffers[index],segment)) {
					clearTimeout(currentStep.timer);
					debug('asserting', 'that the partial buffer does not match the expected value');

					return failed(new AssertionError({
						message:  'Data received does not match expected value',
						expected: segment,
						actual:   buffers[index],
						operator: '=='
					}));
				}

				return;
			}

			clearTimeout(currentStep.timer);
			segment = buffers[index].slice(0, expecting.length);
			if (bufferCompare(expecting, segment)) {
				debug('asserting', 'that the buffer contents do not match');

				return failed(new AssertionError({
					message:  'Data received does not match expected value',
					expected: expecting,
					actual:   segment,
					operator: '=='
				}));

			} else {
				debug('asserting', 'that buffer contents do match');

				steps.shift();
				currentStep.pass();
				buffers[index] = buffers[index].slice(expecting.length);

				return process();
			}
		}
	}

	function processConnect (socket) {
		var currentStep = firstStep();
		debug('processConnect', sockets.length);

		if (!currentStep) {
			try {
				assert(false, 'Received connection after test completion.');
			} finally {
				failed();
			}
		}

		var index = sockets.length;
		sockets.push(socket);

		socket.on('data', function (data) {
			if (!buffers[index]) {
				buffers[index] = new Buffer(data);
			} else {
				buffers[index] = Buffer.concat(buffers[index], data);
			}

			return processData(index);
		});

		var hungup = false;
		socket.on('end', function () {
			if (hungup) return;
			hungup = true;
			processDisconnect(index, 'ended');
		});

		socket.on('close', function () {
			if (hungup) return;
			hungup = true;
			processDisconnect(index, 'closed');
		});

		if (currentStep.is('connection')) {
			debug('asserting', 'connection opened ok');

			clearTimeout(currentStep.timer);
			steps.shift();
			currentStep.pass();

			return process();

		} else {
			debug('asserting', 'that an unexpected connection occurred during', currentStep.type);

			return failed(new AssertionError({
				message:  'Unexpected connection received'
			}));
		}
	}

	function processDisconnect (index, method) {
		var currentStep = firstStep();
		debug('disconnect: ' + method, index);

		if (!sockets[index]) {
			// socket is expected to be closed, we don't care any more.
			return;
		}

		if (!currentStep) {
			return process();
		}

		sockets[index] = null;
		buffers[index] = null;

		if (currentStep.socketIndex === index && (currentStep.is('ended') || currentStep.is('closed')) ) {
			debug('asserting', 'connection ' + method + ' ok');

			clearTimeout(currentStep.timer);
			steps.shift();
			currentStep.pass();

		} else {
			debug('asserting', 'that the socket ' + method + ' too early');

			return failed(new AssertionError({
				message:  'Socket ' + index + ' ' + method + ' early '
			}));
		}

		return process();
	}


	var stepChecks = {
		'listen': function (currentStep) {
			debug('stepCheck', 'listen');

			if (server) {
				debug('asserting', 'the server cannot start because it already is running');
				return failed(new AssertionError({
					message:  'Started listening while a server was already listening.'
				}));
			}

			if (currentStep.secure) {
				server = tls.createServer(currentStep.secure);
			} else {
				server = net.createServer();
			}

			server.on('error', function (err) {
				debug('server error', err);
				return failed(err);
			});

			server.on('connection', processConnect);

			server.on('listening', function () {
				debug('asserting', 'listening for connections');

				steps.shift();
				currentStep.pass();

				return process();
			});

			return server.listen.apply(server, currentStep.arguments || [currentStep.port, currentStep.bind]);
		},

		'connection': function (currentStep) {
			debug('stepCheck', 'connection');

			if (!currentStep.timer) currentStep.timer = setTimeout(function () {
				debug('asserting', 'a timeout waiting for connection');

				return failed(new AssertionError({
					message:  'Timed out waiting for a socket to connect'
				}));

			}, currentStep.timeout || DEFAULT_TIMEOUT);
		},

		'receive': function (currentStep) {
			debug('stepCheck', 'receive');

			if (!currentStep.timer) currentStep.timer = setTimeout(function () {
				debug('asserting', 'a timeout waiting for data');

				return failed(new AssertionError({
					message:  'Timed out waiting for expected data'
				}));

			}, currentStep.timeout || DEFAULT_TIMEOUT);

			processData(currentStep.socketIndex);
		},

		'send': function (currentStep) {
			debug('stepCheck', 'send');

			if (!sockets[currentStep.socketIndex]) {
				debug('sent step occurring out of order');

				return failed(new AssertionError({
					message:  'A sent step was configured to occur before a connection existed'
				}));
			}

			steps.shift();
			sockets[currentStep.socketIndex].write(currentStep.data, function () {
				debug('asserting', 'that data sent');

				currentStep.pass();
				return process();
			});
		},

		'ended': function (currentStep) {
			debug('stepCheck', 'ended');

			if (!currentStep.timer) currentStep.timer = setTimeout(function () {
				debug('asserting', 'a timeout waiting for a socket to end');

				return failed(new AssertionError({
					message:  "Timed out waiting for socket " + currentStep.socketIndex + " to end"
				}));

			}, currentStep.timeout || DEFAULT_TIMEOUT);
		},

		'closed': function (currentStep) {
			debug('stepCheck', 'close');

			var socket = sockets[currentStep.socketIndex];
			if (!socket) {
				debug('asserting', 'that the socket cannot be closed because it does not exist');

				return failed(new AssertionError({
					message:  "Socket " + currentStep.socketIndex + "cannot be closed because it does not exist."
				}));
			}

			if (!currentStep.timer) currentStep.timer = setTimeout(function () {
				debug('asserting', 'a timeout waiting for a socket to close');

				return failed(new AssertionError({
					message:  "Timed out waiting for socket " + currentStep.socketIndex + " to close"
				}));

			}, currentStep.timeout || DEFAULT_TIMEOUT);

			socket.end();
		},

		'buffer is empty': function (currentStep) {
			debug('stepCheck', 'buffer is empty');

			var index = currentStep.socketIndex;
			if (buffers[index] && buffers[index].length) {
				debug('asserting', 'that the connection buffer is not empty');

				return failed(new AssertionError({
					message:  'Expected to have not received any more data from socket ' + index,
					expected: new Buffer(0),
					actual:   buffers[index],
					operator: '=='
				}));

			} else {
				debug('asserting', 'that the connection buffer is empty');

				steps.shift();
				currentStep.pass();
				return process();
			}
		},

		'done': function (currentStep) {
			debug('stepCheck', 'done');
			shutdown(function () {
				currentStep.pass();
			});
		}
	};

	process();

	return {
		abort: shutdown
	};
};
