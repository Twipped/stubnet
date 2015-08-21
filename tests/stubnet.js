
var stubnet = require('../index');
var sinon = require('sinon');
var assert = require('assert');
var net = require('net');


exports['basic connection'] = function (done) {
	var stubs = {
		ok: sinon.stub(),
		equal: sinon.stub()
	};

	var stub = stubnet({assert:stubs})
		.listenTo({port: 50000, ready: onReady, message: 'LISTEN'})
		.expectConnection('CONNECTION OPENED')
		.expectData('hello', 'DATA')
		.expectDisconnect('CONNECTION ENDED')
		.start(onFinish);

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			socket.write('hello', function () {
				assert.ok(true, 'Sent hello');
				socket.end(function () {
					assert.ok(true, 'Closed connection');
				});
			})
		})
	}

	function onFinish() {
		sinon.assert.callCount(stubs.ok, 4);
		sinon.assert.callCount(stubs.equal, 0);

		sinon.assert.calledWithExactly(stubs.ok, true, 'LISTEN');
		sinon.assert.calledWithExactly(stubs.ok, true, "CONNECTION OPENED");
		sinon.assert.calledWithExactly(stubs.ok, true, 'DATA');
		sinon.assert.calledWithExactly(stubs.ok, true, 'CONNECTION ENDED');

		sinon.assert.callOrder(
			stubs.ok.withArgs(true, 'LISTEN'),
			stubs.ok.withArgs(true, "CONNECTION OPENED"),
			stubs.ok.withArgs(true, 'DATA'),
			stubs.ok.withArgs(true, 'CONNECTION ENDED')
		);

		done();
	}
};


exports['unexpected connection and wrong data'] = function (done) {
	var stubs = {
		ok: sinon.stub(),
		equal: sinon.stub()
	};

	var stub = stubnet({assert:stubs})
		.listenTo({port: 50000, ready: onReady, message: 'LISTEN'})
		.expectData('testing', 'EXPECTDATA')
		.start(onFinish);

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			assert.ok(true, 'connected')
			socket.write('hello', function () {
				assert.ok(true, 'Sent hello');
				socket.end(function () {
					assert.ok(true, 'Closed connection');
				});
			})
		})
	}

	function onFinish() {
		sinon.assert.callCount(stubs.ok, 2);
		sinon.assert.callCount(stubs.equal, 1);

		sinon.assert.calledWithExactly(stubs.ok, true,  'LISTEN');
		sinon.assert.calledWithExactly(stubs.ok, false, "Unexpected connection received (EXPECTDATA)");
		sinon.assert.calledWithExactly(stubs.equal, 'hello', 'testi', 'EXPECTDATA');

		sinon.assert.callOrder(
			stubs.ok.withArgs(true,  'LISTEN'),
			stubs.ok.withArgs(false, "Unexpected connection received (EXPECTDATA)"),
			stubs.equal.withArgs('hello', 'testi', 'EXPECTDATA')
		);

		done();
	}
};
