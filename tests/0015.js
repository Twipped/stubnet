var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');
var split   = require('split');
var sinon   = require('sinon');

test('send twice', function (t) {
	t.plan(15);

	stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: t.fail, name: 'expectConnection'})
		.expectData('hello',   {pass: t.pass,  fail: t.fail, name: 'expectData "hello"'})
		.thenSend('there\n',     {pass: t.pass,  fail: t.fail, name: 'thenSend "there"'})
		.thenSend('again\n',     {pass: t.pass,  fail: t.fail, name: 'thenSend "again"'})
		.expectDisconnect(     {pass: t.pass,  fail: t.fail, name: 'expectDisconnect'})
		.start({                pass: t.pass,  done: onFinish,  name: 'server is finished'});

	var stub;
	function onReady() {
		t.pass.apply(this, arguments);

		var i = 2;
		function twice (data) {
			// test has ended. This is to work around `split` triggering another data event when the stream ends
			if (i === null) return;

			t.pass('onData called ' + i + ' ' + data.toString() );
			i--;
			if (i < 1) {
				socket.end(function () {
					i = null;
					t.pass('net.end');
				});
			}
		}
		stub = sinon.spy(twice);

		var socket = new net.Socket();

		socket.pipe(split()).on('data', stub);

		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello', function () {
				t.pass('net.send "hello"');
			});
		});
	}

	function onFinish () {
		t.true(stub.calledTwice);
		t.equal(stub.getCall(0).args[0].toString(), 'there');
		t.equal(stub.getCall(1).args[0].toString(), 'again');

		t.end();
	}

});
