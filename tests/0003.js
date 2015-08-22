
var test    = require('tap').test;
var sinon   = require('sinon');
var stubnet = require('../index');
var net     = require('net');
var AssertionError = require('assert').AssertionError;


function failureHook (t) {
	return sinon.spy(function () {
		t.pass(this.name);
	});
}

test('expected connection and wrong data', function (t) {
	t.plan(8);

	var stub = failureHook(t);

	stubnet()
		.listenTo({port: 50000, pass: onReady, fail: stub, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: stub, name: 'expectConnection'})
		.expectData('testing', {pass: t.fail,  fail: stub, name: 'expectData'})
		.start({pass: t.pass,  done: onFinish,  name: 'server is finished'});

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello', function () {
				t.pass('net.send "hello"');
				socket.end(function () {
					t.pass('net.end');
				});
			});
		});
	}

	function onFinish() {
		t.equal(stub.callCount, 1, 'only one failure detected');

		var failureValue = stub.getCall(0).args[0];
		t.ok(failureValue instanceof AssertionError, 'received an AssertionError');
		t.equal(failureValue.message, 'Data received does not match expected value');

		t.end();
	}

});
