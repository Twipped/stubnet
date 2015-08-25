var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');

test('basic connection', function (t) {

	stubnet()
		.listenTo({port: 50000, done: onReady})
		.expectConnection()
		.expectData('hello')
		.thenSend('hi there')
		.expectDisconnect()
		.start(onFinish);

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello', function () {
				t.pass('net.send "hello"');
			});
			socket.on('data', function (data) {
				t.equal(data.toString(), 'hi there');
				socket.end(function () {
					t.pass('net.end');
				});
			});
		});
	}

	function onFinish(failed) {
		if (failed) {
			t.fail(failed);
		} else {
			t.pass('test complete');
		}
		t.end();
	}

});
