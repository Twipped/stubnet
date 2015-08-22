var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');

var sinon   = require('sinon');
var AssertionError = require('assert').AssertionError;
function failureHook (t) {
	return sinon.spy(function () {
		t.pass(this.name);
	});
}

test('never connects', function (t) {
	t.plan(5);

	var stub = failureHook(t);
	function onFail() {stub.apply(this, arguments);}

	stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: onFail, name: 'expectConnection', timeout: 500})
		.expectData('hello',   {pass: t.fail,  fail: t.fail, name: 'expectData "hello"'})
		.thenClose(            {pass: t.pass,  fail: t.fail, name: 'thenClose'})
		.start({                pass: t.pass,  done: onFinish,  name: 'server is finished'});

	function onReady() {
		t.pass.apply(this, arguments);

		
	}

	function onFinish () {
		t.equal(stub.callCount, 1, 'only one failure detected');

		var failureValue = stub.getCall(0).args[0];
		t.ok(failureValue instanceof AssertionError, 'received an AssertionError');
		t.equal(failureValue.message, 'Timed out waiting for a socket to connect', 'assertion message matches');

		t.end();
	}

});
