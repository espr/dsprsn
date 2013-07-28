Router = require '../../lib/rpc/router.js'

CONTINUATION_DELAY_MS = 0

P1 = 'first_parameter'
P2 = {second: 'parameter'}

ROUTE_PARAM = "must_be_string"
AN_OBJ = {}

#
# This is a comment
#

describe 'Router', ->

  it "should call a root listener on root route", (done)->
    router = new Router()

    router.on (p1,p2)->
      assert.equal(p1, P1, "first parameter")
      assert.equal(p2, P2, "second parameter")

      done()

    router.handle("/", P1, P2)

  it "should call only listeners which match", (done)->
    router = new Router()
    handlerSpy = sinon.spy()

    router.on "/not/test/path", handlerSpy
    router.on "/test/path/", (p1,p2)->
      assert.equal(p1, P1, "first parameter")
      assert.equal(p2, P2, "second parameter")
      assert(!handlerSpy.called, "handlerSpy should not be called")

      done()

    router.handle("/test/path", P1, P2)

  it "should match route params and attach to first param", (done)->
    router = new Router()

    router.on "/test/:myparam", (p1,p2)->
      assert.equal(p1, AN_OBJ, "first parameter")
      assert(p1.params, "params attached")
      assert.equal(p1.params.myparam, ROUTE_PARAM)
      done()

    router.handle("/test/#{ROUTE_PARAM}", AN_OBJ, P2)

  it "should support before filters", (done)->
    router = new Router()

    router.before (p)->
      p.myP1 = P1
    router.before "/anyofthis", (p)->
      p.myP2 = P2

    router.on "/unrelated", (pA)->
      assert.deepEqual(pA.myP1, P1)
      assert.isUndefined(pA.myP2)
      router.handle("/anyofthis/specifically", {})

    router.on "/anyofthis/specifically", (pB)->
      assert.deepEqual(pB.myP1, P1)
      assert.deepEqual(pB.myP2, P2)
      done()

    router.handle("/unrelated", {})
