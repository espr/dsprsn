Adapter = require '../../lib/adapters/adapter.js'

MSG = {}

describe 'Adapter', ->

  it "server should emit when a message is received from a client", (done)->
    server = new Adapter.Server()
    server.on 'new', (conn)->
      conn.on (msg)->
        assert.deepEqual(MSG, msg, "preserve msg")
        done()

    client = new Adapter.Client(server: server)
    client.send(MSG)

  it "client should emit when a message is received from another node", (done)->
    server = new Adapter.Server()
    server.on 'new', (conn)->
      conn.send(MSG)
    client = new Adapter.Client(server: server)
    client.on (msg)->
      assert.deepEqual(MSG, msg, "preserve msg")
      done()
