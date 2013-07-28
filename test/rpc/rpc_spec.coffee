util = require "espr-util"
Adapter = require "../../lib/adapters/adapter.js"
RpcClient = require "../../lib/rpc/client.js"
RpcServer = require "../../lib/rpc/server.js"
Router = require "../../lib/rpc/router.js"

MSG_DELAY = 0
MSG1 = {'msg':'one'}
MSG2 = {'msg':'two'}
REQ = {'msg':'req'}
RSP = {'msg':'rsp'}
TEST_ROUTE = "/test_route"

delay = (d, f)->
  if typeof d is 'function'
    f = d
    d = MSG_DELAY
  setTimeout(f,d)

server = null
client = null

describe 'rpc', ->

  beforeEach ->
    server = new RpcServer()
    client = new RpcClient(adapter: new Adapter.Client(server: server._adapter))

  it "should complete request-response cycle", (done)->
    server.on (req)->
      assert.equal(req, REQ, 'request')
      @resolve RSP
    server.listen()

    client.send(REQ).done (rsp)->
      assert.equal(rsp, RSP, 'response')
      done()

  it "should resolve promises", (done)->
    server.on (req)->
      assert.equal(req, REQ, 'request')
      d = new util.Deferred()
      delay ->
        d.fulfill(RSP)
      @fulfill d.promise
    server.listen()

    client.send(REQ).done (rsp)->
      assert.equal(rsp, RSP, 'response')
      done()

  it "should receive events sent over a returned channel", (done)->
    server.on (req)->
      assert.equal(req, REQ, 'request')
      clchnl = @
      delay ->
        clchnl.send(MSG1)
        delay ->
          clchnl.send(MSG2)
          delay ->
            clchnl.resolve(RSP)
    server.listen()

    msg1spy = sinon.spy()
    msg2spy = sinon.spy()
    chnl = client.send(REQ)
    chnl.on (p)->
      if p.msg is 'one'
        msg1spy()
      else if p.msg is 'two'
        msg2spy()
    chnl.done (r)->
      assert.deepEqual(r, RSP)
      assert(msg1spy.calledOnce, "msg1spy called")
      assert(msg2spy.calledOnce, "msg2spy called")
      done()

  it "should handle requests over channels", (done)->
    chnlMsgSpy = sinon.spy()
    chnlDoneSpy = sinon.spy()

    server.on (req)->
      assert.equal(req, REQ, 'request')
      clchnl = @
      clchnl.on (m1)->
        assert.deepEqual(m1, MSG1)
        clsubchnl = @
        delay ->
          clsubchnl.send(MSG1)
          delay ->
            clsubchnl.resolve(MSG2)
            delay ->
              clchnl.resolve(RSP)
    server.listen()

    chnl = client.send(REQ)
    subchnl = chnl.send(MSG1)
    subchnl.on (p)->
      assert.deepEqual(p, MSG1)
      chnlMsgSpy()
    subchnl.done (q)->
      assert.deepEqual(q, MSG2)
      chnlDoneSpy()
    chnl.done (r)->
      assert.deepEqual(r, RSP)
      assert(chnlMsgSpy.calledOnce, "chnlMsgSpy called")
      assert(chnlDoneSpy.calledOnce, "chnlDoneSpy called")
      done()

  it "should pass requests to a provided router", (done)->
    router = new Router()
    router.on TEST_ROUTE, (p1)->
      assert.equal(p1, REQ)
      clchnl = @
      delay ->
        clchnl.send(MSG1)
        delay ->
          clchnl.resolve(RSP)

    server.on router.handle
    server.listen()

    chnlMsgSpy = sinon.spy()
    chnl = client.send(TEST_ROUTE, REQ)
    chnl.on ()->
      chnlMsgSpy()
    chnl.done (p3)->
      assert.equal(p3, RSP)
      assert(chnlMsgSpy.calledOnce, "chnlMsgSpy called")
      done()
