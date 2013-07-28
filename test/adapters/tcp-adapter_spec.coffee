net = require 'net'
TcpAdapter = require '../../lib/adapters/tcp-adapter.js'

MSG = {a_small:'test msg'}
TPORT = 20415

encodeTcpCall = ()->
  message = JSON.stringify(Array.prototype.slice.call(arguments, 0))
  return "#{message.length}\n#{message}\n"

describe 'TcpAdapter', ->

  it 'server should accept clients and recieve messages', (done)->
      # create dsprsn server
      server = new TcpAdapter.Server(port: TPORT)
      server.on 'new', (conn)->
        conn.receive (msg)->
          assert.deepEqual(MSG, msg, 'preserve msg')
          server.close ->
            done()
      server.listen ->
        # create nodejs tcp client
        sock = net.connect(port: TPORT, ()->
          setTimeout(->
            # send message
            sock.write(encodeTcpCall(MSG))
            sock.end()
          , 0)
        )

  it "server should receive when a message is received from a client", (done)->
    # create dsprsn server
    server = new TcpAdapter.Server(port: TPORT)
    server.on 'new', (conn)->
      conn.receive (msg)->
        assert.deepEqual(MSG, msg, 'preserve msg')
        server.close ->
          done()
    server.listen ->
      # create dsprsn client
      client = new TcpAdapter.Client(port: TPORT)
      setTimeout(->
        # send message
        client.send(MSG)
        client.end()
      , 0)


  it "client should receive when a message is received from a server", (done)->
    # create dsprsn server
    server = new TcpAdapter.Server(port: TPORT)
    server.on 'new', (conn)->
      conn.send(MSG)
    server.listen ->
      # create dsprsn client
      client = new TcpAdapter.Client(port: TPORT)
      client.receive (msg)->
        assert.deepEqual(MSG, msg, 'preserve msg')
        client.end()
        done()
