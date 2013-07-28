var util = require('espr-util')
var superRareId = require('super-rare-id')
var Adapter = require('../adapters/adapter.js')

/**
  @class RpcClient
  @constructor
**/
function RpcClient(options) {
  if (!options) throw new Error("options required")
  if (!options.adapter) throw new Error("options.adapter required")
  this._adapter = options.adapter
  this._adapter.on(this.handle.bind(this))
  this._requestChannels = {}
}

/**
  @class RpcClientChannel
  @constructor
**/
function RpcClientChannel(options) {
  if (!options) throw new Error("options required")
  if (!options.client) throw new Error("options.client required")
  this.client = options.client
  this._deferred = new util.Deferred()
  this._init = new util.Deferred()
  this.then = this._deferred.promise.then.bind(this._deferred)
  this.done = this._deferred.promise.done.bind(this._deferred)
}

util.extends(RpcClient, util.Events)
util.extends(RpcClientChannel, util.Events)

RpcClient.prototype.send = function() {
  var emitArgs = Array.prototype.slice.call(arguments, 0)
  var meta = {}
  meta.rpc_req_id = superRareId()
  emitArgs.unshift(meta)
  this._adapter.send.apply(this._adapter, emitArgs)
  this._requestChannels[meta.rpc_req_id] = new RpcClientChannel({client: this})
  return this._requestChannels[meta.rpc_req_id]
}

RpcClient.prototype.handle = function(meta) {
  var args = Array.prototype.slice.call(arguments, 1)
  var channel = this._requestChannels[meta.rpc_req_id]
  if (!channel) {
    throw new Error("channel "+meta.rpc_req_id+" not found for response")
  }
  if (meta.inited) {
    channel._init.fulfill(meta)
  } else if (meta.resolved) {
    args.unshift(!!meta.fulfilled)
    channel._deferred.resolve.apply(channel._deferred, args)
    delete this._requestChannels[meta.rpc_req_id]
  } else {
    args.unshift(meta.event_name || '')
    channel.emit.apply(channel, args)
  }
}

RpcClientChannel.prototype.send = function() {
  var emitArgs = Array.prototype.slice.call(arguments, 0)
  var channel = new RpcClientChannel({client: this})
  this._init.promise.done(function(channel_meta){
    var meta = {}
    meta.rpc_req_id = superRareId()
    meta.rpc_channel_id = channel_meta.rpc_channel_id
    emitArgs.unshift(meta)
    this.client._requestChannels[meta.rpc_req_id] = channel
    this.client._adapter.send.apply(this.client._adapter, emitArgs)
  }.bind(this))
  return channel
}

module.exports = RpcClient