
var stubnet = require('../index');
var net = require('net');


exports['basic connection'] = function (test) {
	test.expect(6);

	var stub = stubnet({assert:test})
		.listenTo({port: 50000, ready: onReady})
		.expectConnection('CONNECTION OPENED')
		.expectData('hello', 'DATA')
		.expectDisconnect('CONNECTION ENDED')
		.start(function () {
			test.done();
		})

	function onReady() {
		var socket = new net.Socket();
		socket.connect(50000, 'localhost', function () {
			socket.write('hello', function () {
				test.ok(true, 'Sent hello');
				socket.end(function () {
					test.ok(true, 'Closed connection');
				});
			})
		})
	}
};
