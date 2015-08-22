var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');

test('sending non-text buffer data', function (t) {
	t.plan(8);

	var mockServer = stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: t.fail, name: 'expectConnection'})
		.expectData(new Buffer([ 8, 6, 7, 5, 3, 0, 9]),   {pass: t.pass,  fail: t.fail, name: 'expectData'})
		.expectDisconnect(     {pass: t.pass,  fail: t.fail, name: 'expectDisconnect'})
		.start({                pass: t.pass,  done: t.end,  name: 'server is finished'});

	t.ok(mockServer.abort, 'abort function exists');

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write(new Buffer([ 8, 6, 7, 5, 3, 0, 9]), function () {
				t.pass('net.send "hello"');
				socket.end(function () {
					t.pass('net.end');
				});
			});
		});
	}

});
