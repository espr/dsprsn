var net = require('net')
var util = require('espr-util')
var Adapter = require('./adapter.js')

/**
  @class TcpAdapterClient
  @constructor
**/
function TcpAdapterClient(options) {
  if (!(options && options.port!==undefined)) {
    throw new Error('TcpAdapterClient(options) requires options.port')
  }
  this._conn = net.connect({port: options.port})
  this._conn.on('data', this.onDataHandler.bind(this))
}

/**
  @class TcpAdapterServer
  @constructor
**/
function TcpAdapterServer(options) {
  if (!(options && options.port!==undefined)) {
    throw new Error('TcpAdapterServer(options) requires options.port')
  }
  this.options = options
}

/**
  @class TcpConnectedClient
  @constructor
**/
function TcpConnectedClient(options) {
  if (!options.conn) {
    throw new Error('TcpConnectedClient(options) requires options.conn')
  }
  this._cli = options.conn
  this._cli.on('data', this.onDataHandler.bind(this))
}

util.extends(TcpAdapterClient, Adapter.Client)
util.extends(TcpAdapterServer, Adapter.Server)
util.extends(TcpConnectedClient, util.Events)

/**
 * Defines encoding and decoding rules for tcp messages.
 * @class TcpMessage
 * @static
 */
var TcpMessage = {
  encode: function encodeTcpMessage() {
    var message = JSON.stringify(Array.prototype.slice.call(arguments, 0))
    return message.length.toString()+"\n"+message+"\n"
  },

  decode: function decodeTcpMessage(dataBuffer) {
    var dbufSeven = dataBuffer.toString('utf8',0,7)
    var epos = dbufSeven.indexOf('\n')
    if (epos < 1) {
      throw new Error("Could not parse dbufSeven "+dbufSeven)
    }
    var length = parseInt(dbufSeven.substr(0,epos))
    var msgStr = dataBuffer.toString('utf8',epos+1,epos+length+1)
    try {
      var args = JSON.parse(msgStr)
      if (!(args instanceof Array)) {
        throw new Error("args recieved from client is not array "+args)
      }
      return args
    } catch(ce) {
      var e = new Error("Could not parse json for message")
      e.message = msgStr
      e.cause = ce
      throw e
    }
  }
}

TcpAdapterClient.prototype.send = function() {
  var args = arguments
  process.nextTick(function(){
    this._conn.write(TcpMessage.encode.apply(null,args))
  }.bind(this))
}
TcpAdapterClient.prototype.receive = function(listener) {
  this.on('msg',listener)
}
TcpAdapterClient.prototype.onDataHandler = function(buffer) {
  var args = TcpMessage.decode(buffer)
  args.unshift('msg')
  this.emit.apply(this,args)
}
TcpAdapterClient.prototype.end = function() {
  process.nextTick(function(){
    this._conn.end()
  }.bind(this))
}

TcpAdapterServer.prototype.listen = function(cb) {
  var tcpAdapterServer = this
  this.server = net.createServer(function(conn) {
    var cli = new TcpConnectedClient({conn: conn})
    tcpAdapterServer.emit('new', cli)
  })
  this.server.listen(this.options.port, function() {
    cb(tcpAdapterServer)
  })
}
TcpAdapterServer.prototype.close = function(cb) {
  this.server.close(cb)
}

TcpConnectedClient.prototype.send = function() {
  var args = arguments
  process.nextTick(function(){
    this._cli.write(TcpMessage.encode.apply(null,args))
  }.bind(this))
}
TcpConnectedClient.prototype.receive = function(listener) {
  this.on('msg',listener)
}
TcpConnectedClient.prototype.onDataHandler = function(dataBuffer) {
  var args = TcpMessage.decode(dataBuffer)
  process.nextTick(function(){
    args.unshift('msg')
    this.emit.apply(this,args)
  }.bind(this))
}

/**
  Adapters wrap transports for communication between clients and servers.

  @class Adapter
  @static
**/
var TcpAdapter = module.exports = {
  Client: TcpAdapterClient,
  Server: TcpAdapterServer
}
