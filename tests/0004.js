var test    = require('tap').test;
var stubnet = require('../index');
var net     = require('net');
var Promise = require('bluebird');
var proxmis = require('proxmis');

test('expected connection and valid data, with close', function (t) {
	t.plan(10);

	var stubnetDone = proxmis({noError: true});
	var socketDone  = proxmis({noError: true});

	var mockServer = stubnet()
		.listenTo({port: 50000, pass: onReady, fail: t.fail, name: 'listenTo'})
		.expectConnection(     {pass: t.pass,  fail: t.fail, name: 'expectConnection'})
		.expectData('hello',   {pass: t.pass,  fail: t.fail, name: 'expectData'})
		.expectNoData(         {pass: t.pass,  fail: t.fail, name: 'expectNoData'})
		.thenClose(            {pass: t.pass,  fail: t.fail, name: 'thenClose'})
		.start({                pass: t.pass,  fail: t.fail, done: stubnetDone,  name: 'server is finished'});

	t.ok(mockServer.abort, 'abort function exists');

	function onReady() {
		t.pass.apply(this, arguments);

		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			t.pass('net.connect');
			socket.write('hello', function () {
				t.pass('net.send "hello"');
			});
			socket.on('end', function () {
				t.pass('net.ended');
				socketDone();
			});
		});
	}

	Promise.join(stubnetDone, socketDone).then(t.end);

});
