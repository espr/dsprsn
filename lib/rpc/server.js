var util = require('espr-util')
var superRareId = require('super-rare-id')
var Adapter = require('../adapters/adapter.js')
var RpcClient = require('./client.js')

/**
  @class RpcServer
  @constructor
**/
function RpcServer(options) {
  if (options && options.adapter) {
    this._adapter = options.adapter
  } else {
    this._adapter = new Adapter.Server()
  }
}

/**
  @class RpcChannel
  @constructor
**/
function RpcChannel(options) {
  RpcChannel.__super__.constructor.apply(this, arguments)
  if (!options) throw new Error('RpcChannel requires options')
  if (!options.conn) throw new Error('RpcChannel requires options.conn')
  this.id = superRareId()
  this._conn = options.conn
  var _deferred = new util.Deferred()
  this.fulfill = _deferred.fulfill
  this.resolve = _deferred.fulfill
  this.reject = _deferred.reject
  this._promise = _deferred.promise
}

util.extends(RpcServer, util.Events)
util.extends(RpcChannel, util.Events)

RpcServer.prototype.listen = function() {
  this._adapter.on('new', this.setupConnection.bind(this))
  if ('function'===typeof this._adapter.listen)
    this._adapter.listen()
}

RpcServer.prototype.setupConnection = function(conn) {
  conn._channels = {_closed:{}}
  conn.on(function(req_meta){
    var channel

    var emitArgs = Array.prototype.slice.call(arguments, 1)
    if (req_meta && req_meta.rpc_channel_id) {
      var parentChannel
      if (parentChannel = conn._channels[req_meta.rpc_channel_id]) {
        channel = new RpcChannel({conn:conn})
        if (parentChannel._eventSubscribers&&parentChannel._eventSubscribers.hasOwnProperty('')) {
          parentChannel._eventSubscribers[''].forEach(function(fn){
            fn.apply(channel, emitArgs)
          });
        }
      } else {
        if (conn._channels._closed[req_meta.rpc_channel_id]) {
          throw new Error("request emitted over closed channel "+req_meta.rpc_channel_id)
        } else {
          throw new Error("bad channel id "+req_meta.rpc_channel_id)
        }
      }
    } else {
      channel = new RpcChannel({conn:conn})
      if (this._eventSubscribers&&this._eventSubscribers.hasOwnProperty('')) {
        this._eventSubscribers[''].forEach(function(fn){
          fn.apply(channel, emitArgs)
        });
      }
    }

    // if (result instanceof RpcChannel) {
    //   // todo resolve new channel
    //   // channel = result
    // } else if (result && 'function'===typeof result.then) {
    //   if ('function'===typeof result.done) {
    //     result.done(channel.resolve, channel.reject)
    //   } else {
    //     result.then(channel.resolve, channel.reject)
    //   }
    // } else {
    //   channel.resolve(result)
    // }

    conn._channels[channel.id] = channel
    channel.attach(req_meta)
    conn.send.call(conn, {
      inited: true,
      rpc_req_id: req_meta.rpc_req_id,
      rpc_channel_id: channel.id
    })
  }.bind(this))
}

RpcServer.prototype.client = function() {
  return new RpcClient({
    adapter: new Adapter.Client({server: this._adapter})
  })
}

RpcChannel.prototype.send = function() {
  if (!this._conn) {
    if (!this._buffer) {
      this._buffer = []
    }
    this._buffer.push(arguments)
  } else {
    var emitArgs = Array.prototype.slice.call(arguments, 0)
    emitArgs.unshift(this._meta)
    this._conn.send.apply(this._conn, emitArgs)
  }
}

RpcChannel.prototype.listenTo = function(obj, eventName) {
  var inst = this
  var listener = function(){
    var args = Array.prototype.slice(0)
    args.unshift(eventName)
    inst.send.apply(inst,args)
  }
  var unsubFn = function(){
    obj.off(eventName, listener)
  }
  // this._promise.then(unsubFn,unsubFn)
  obj.on(eventName, listener)
  return this
}

RpcChannel.prototype.attach = function(meta) {
  this._meta = meta
  // empty buffer
  if (this._buffer) {
    this._buffer.forEach(function(emitArgs){
      emitArgs.unshift(this._meta)
      this._conn.send.apply(this._conn, emitArgs)
    })
  }
  delete this._buffer
  // listen for promise completion
  this._promise.done(function(){
    this._meta.resolved = true
    this._meta.fulfilled = true
    this.send.apply(this, arguments)
    this._conn._channels._closed[this.id] = true
    delete this._conn._channels[this.id]
  }.bind(this),
  function(){
    this._meta.resolved = true
    this._meta.fulfilled = false
    this.send.apply(this, arguments)
    this._conn._channels._closed[this.id] = true
    delete this._conn._channels[this.id]
  }.bind(this))
}

RpcServer.Channel = RpcChannel
module.exports = RpcServer
