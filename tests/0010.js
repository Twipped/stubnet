var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');
var Promise = require('bluebird');
var proxmis = require('proxmis');

var sinon   = require('sinon');
var AssertionError = require('assert').AssertionError;
function failureHook (t) {
	return sinon.spy(function () {
		t.pass(this.name);
	});
}

test('receives incorrect data', function (t) {
	t.plan(9);

	var stubnetDone = proxmis({noError: true});
	var socketDone  = proxmis({noError: true});

	var stub = failureHook(t);
	function onFail() {stub.apply(this, arguments);}

	stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: t.fail, name: 'expectConnection'})
		.expectData('hello',   {pass: t.fail,  fail: onFail, name: 'expectData "hello"'})
		.thenClose(            {pass: t.pass,  fail: t.fail, name: 'thenClose'})
		.start({                pass: t.pass,  done: stubnetDone,  name: 'server is finished'});

	function onReady() {
		t.pass.apply(this, arguments);

		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('there', function () {
				t.pass('net.send "there"');
			});
			socket.on('end', function () {
				t.pass('net.ended');
				socketDone();
			});
		});
	}

	Promise.join(stubnetDone, socketDone).then(function onFinish () {
		t.equal(stub.callCount, 1, 'only one failure detected');

		var failureValue = stub.getCall(0).args[0];
		t.ok(failureValue instanceof AssertionError, 'received an AssertionError');
		t.equal(failureValue.message, 'Data received does not match expected value', 'assertion message matches');

		t.end();
	});

});
