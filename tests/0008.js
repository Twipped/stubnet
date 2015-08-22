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

test('expecting two data chunks, second never fully arrives', function (t) {
	t.plan(10);

	var stub = failureHook(t);
	function onFail() {stub.apply(this, arguments);}

	stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: onFail, name: 'expectConnection'})
		.expectData('hello\n', {pass: t.pass,  fail: onFail, name: 'expectData hello'})
		.expectData('there\n', {pass: t.pass,  fail: onFail, name: 'expectData there'})
		.expectDisconnect(     {pass: t.pass,  fail: onFail, name: 'expectDisconnect'})
		.start({                pass: t.pass,  done: onFinish,  name: 'server is finished'});

	function onReady() {
		t.pass.apply(this, arguments);

		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello\nther', function () {
				t.pass('net.send "hello<return>ther"');
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
		t.equal(failureValue.message, 'Socket 0 ended early', 'assertion message matches');

		t.end();
	}

});
