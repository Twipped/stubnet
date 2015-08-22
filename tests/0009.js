var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');

test('expect data then send response', function (t) {
	t.plan(10);

	stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: t.fail, name: 'expectConnection'})
		.expectData('hello',   {pass: t.pass,  fail: t.fail, name: 'expectData "hello"'})
		.thenSend('there',     {pass: t.pass,  fail: t.fail, name: 'thenSend "there"'})
		.expectDisconnect(     {pass: t.pass,  fail: t.fail, name: 'expectDisconnect'})
		.start({                pass: t.pass,  done: t.end,  name: 'server is finished'});

	function onReady() {
		t.pass.apply(this, arguments);

		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello', function () {
				t.pass('net.send "hello"');
			});

			socket.on('data', function (data) {
				t.equal(data.toString(), 'there');
				socket.end(function () {
					t.pass('net.end');
				});
			});
		});
	}

});
