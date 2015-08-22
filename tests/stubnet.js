
var test    = require('tap').test;
var sinon   = require('sinon');
var stubnet = require('../index');
var net     = require('net');
var AssertionError = require('assert').AssertionError;


var inspect = require('util').inspect;

function failureHook (t) {
	return sinon.spy(function () {
		t.pass(this.name);
	});
}

test('basic connection', function (t) {

	var mockServer = stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: t.fail, name: 'expectConnection'})
		.expectData('hello',   {pass: t.pass,  fail: t.fail, name: 'expectData'})
		.expectDisconnect(     {pass: t.pass,  fail: t.fail, name: 'expectDisconnect'})
		.start({                pass: t.pass,  done: t.end,  name: 'server is finished'});

	t.ok(mockServer.abort, 'abort function exists');

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello', function () {
				t.pass('net.send "hello"');
				socket.end(function () {
					t.pass('net.end');
				});
			})
		})
	}

});


test('unexpected connection and wrong data', function (t) {

	var stub = failureHook(t);

	var mockServer = stubnet()
		.listenTo({port: 50000, pass: onReady, fail: stub, name: 'listenTo'})
		.expectData('testing', {pass: t.fail,  fail: stub, name: 'expectData'})
		.start({pass: t.pass,  done: onFinish,  name: 'server is finished'});

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect')
			socket.write('hello', function () {
				t.pass('net.send "hello"');
				socket.end(function () {
					t.pass('net.end');
				});
			})
		})
	}

	function onFinish() {
		t.equal(stub.callCount, 1, 'only one failure detected');

		var failureValue = stub.getCall(0).args[0];
		t.ok(failureValue instanceof AssertionError, 'received an AssertionError');
		t.equal(failureValue.message, 'Unexpected connection received');

		t.end();
	}

});
