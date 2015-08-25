Stubnet
==================

Stubnet is a testing library for creating fake TCP servers that can be connected to in automated tests, which will behave in a defined manner.  Server behavior is defined as a sequential set of steps of data received and sent.

###Example Test ([tap](https://www.npmjs.com/package/tap))
```js
var test    = require('tap').test;
var stubnet = require('stubnet');
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
```

##Usage

####`stubnet()`

Returns a Builder instance, a chainable class for defining the steps of the server process.

####`builder.listenTo(options)`

Note, this _must_ be the first step that you define, as it informs the server where to listen for connections.

- **`options`**

  - `arguments`: Optional array of arguments to pass to `server.listen()`
  - `port`: The port number to listen on. Required unless defined in the `arguments` option.
  - `bind`: The address to bind to (Defaults to 0.0.0.0).
  - `secure`: Optional. If defined, stubnet will [create a tls server](https://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener) with the options   defined.
  - `pass`: Callback to invoke when the server starts successfully and is ready for connections.
  - `fail`: Callback invoked if the server fails to start. Will receive the socket error as the first argument.
  - `done`: Callback invoked in both success and failure conditions. Will receive the error as the first argument if one occurred.

####`builder.expectConnection([options | callback])`

Note, you must define at least one `expectConnection` condition. Failure to do so will cause the server to abort with an 'Unexpected connection' message.

- **`options`** (optional)

  - `timeout`: Number of milliseconds to wait for a connection before failing the test.
  - `pass`: Callback to invoke when the connection is received.
  - `fail`: Callback invoked if no connection is received before the timeout occurs.
  - `done`: Callback invoked in both success and failure conditions. Will receive an AssertionError as the first argument if the step failed

- **`callback`**: A `done` callback function may optionally be provided in place of options.

####`builder.expectData(data, [options | callback])`

####`builder.expectDataFrom(index, data, [options | callback])`

The `expectData` step scan the socket data buffer until either all of the expected data is seen, or the buffer contains a mismatched value. Matched data is then removed from the data buffer.

- **`index`**: If multiple connections are being made, `expectDataFrom` may be used to identify which connection (order of connecting, zero-based).

- **`data`** may be any acceptable input for a [Buffer](https://nodejs.org/api/buffer.html), including strings, integer arrays, or pre-made buffers.

- **`options`** (optional)

  - `timeout`: Number of milliseconds to wait for the data to fully arrive.
  - `pass`: Callback to invoke when the matching data is received.
  - `fail`: Callback invoked if the data does not match, or the complete data is not received before the timeout occurs. Receives an equality AssertionError as the first argument.
  - `done`: Callback invoked in both success and failure conditions. Will receive an AssertionError as the first argument if the step failed

- **`callback`**: A `done` callback function may optionally be provided in place of options.

####`builder.thenSend(data, [options | callback])`
####`builder.thenSendTo(index, data, [options | callback])`

When this step evaluates it will send the provided `data` to the socket.  The step passes when the send buffer is fully drained to the system kernal.

- **`index`**: If multiple connections are being made, `thenSendTo` may be used to identify which connection (order of connecting, zero-based).

- **`data`** may be any acceptable input for a [Buffer](https://nodejs.org/api/buffer.html), including strings, integer arrays, or pre-made buffers.

- **`options`** (optional)

  - `pass`: Callback to invoke when the data is sent.
  - `fail`: Callback invoked if an error occurred while sending the data.  Will receive the error as the first argument.
  - `done`: Callback invoked in both success and failure conditions. Will receive the error as the first argument if one occurred.

- **`callback`**: A `done` callback function may optionally be provided in place of options.

####`builder.expectNoData([options | callback])`
####`builder.expectNoDataFrom(index, [options | callback])`

Step to confirm that no further data has been received from the socket before moving on to the next step.

- **`index`**: If multiple connections are being made, `expectNoDataFrom` may be used to identify which connection (order of connecting, zero-based).

- **`options`** (optional)

  - `pass`: Callback to invoke if the data buffer is empty.
  - `fail`: Callback invoked if the data buffer is NOT empty. Receives an equality AssertionError as the first argument.
  - `done`: Callback invoked in both success and failure conditions. Will receive an AssertionError as the first argument if the step failed

- **`callback`**: A `done` callback function may optionally be provided in place of options.

####`builder.expectDisconnect([options | callback])`
####`builder.expectDisconnectBy(index, [options | callback])`

Waits for the socket to close from the other side.

- **`index`**: If multiple connections are being made, `expectDisconnectBy` may be used to identify which connection (order of connecting, zero-based).

- **`options`** (optional)

  - `timeout`: Number of milliseconds to wait for the socket to close before failing the test.
  - `pass`: Callback to invoke when the connection is received.
  - `fail`: Callback invoked if no connection is received before the timeout occurs.
  - `done`: Callback invoked in both success and failure conditions. Will receive an AssertionError as the first argument if the step failed.

- **`callback`**: A `done` callback function may optionally be provided in place of options.

####`builder.thenClose([index],[options | callback])`

Step to confirm that no further data has been received from the socket before moving on to the next step.

- **`index`**: If multiple connections are being made, the connection index (order of connecting, zero-based) may be used to identify which connection to close.

- **`options`** (optional)

  - `pass`: Callback to invoke when the connection closes.
  - `fail`: Callback invoked if the connection closure times out, or another error occurs.
  - `done`: Callback invoked in both success and failure conditions. Will receive the error as the first argument if one occurred.

- **`callback`**: A `done` callback function may optionally be provided in place of options.

####`builder.start([options | callback])`

Start the server.  This function returns a `runner` object.

- **`options`** (optional)

  - `pass`: Callback to invoke when all steps have completed successfully.
  - `fail`: Callback invoked if any of the steps have failed. Receives the same error that was provided to that step's fail function.
  - `done`: Callback invoked in both success and failure conditions. Will receive the error as the first argument if one occurred.

- **`callback`**: A `done` callback function may optionally be provided in place of options.

####`runner.abort()`

Aborts the run, stopping the server and triggering a failure condition on the current step.
