var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');

test('expecting two data chunks, mismatched packets', function (t) {
	t.plan(10);

	var mockServer = stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: t.fail, name: 'expectConnection'})
		.expectData('hello\n', {pass: t.pass,  fail: t.fail, name: 'expectData hello'})
		.expectData('there\n', {pass: t.pass,  fail: t.fail, name: 'expectData there'})
		.expectDisconnect(     {pass: t.pass,  fail: t.fail, name: 'expectDisconnect'})
		.start({                pass: t.pass,  done: t.end,  name: 'server is finished'});

	t.ok(mockServer.abort, 'abort function exists');

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello\nth', function () {
				t.pass('net.send "hello<return>th"');
				socket.write('ere\n', function () {
					t.pass('net.send "ere<return>"');
					socket.end(function () {
						t.pass('net.end');
					});
				});
			});
		});
	}

});
